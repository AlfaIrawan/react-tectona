"""LAN-only development override; forward every other name to the network DNS."""
import argparse
import ipaddress
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(os.environ['LOCALAPPDATA']) / 'Tectona/dev-dns/deps'))
from dnslib import A, DNSRecord, QTYPE, RCODE, RR
from dnslib.server import BaseResolver, DNSLogger, DNSServer


class LocalResolver(BaseResolver):
    def __init__(self, domain, address, upstream):
        self.domain = domain.lower().rstrip('.') + '.'
        self.address = address
        self.network = ipaddress.ip_network(address + '/24', strict=False)
        self.upstream = upstream

    def resolve(self, request, handler):
        reply = request.reply()
        if ipaddress.ip_address(handler.client_address[0]) not in self.network:
            reply.header.rcode = RCODE.REFUSED
            return reply
        if str(request.q.qname).lower() == self.domain:
            reply.header.aa = 1
            if request.q.qtype == QTYPE.A:
                reply.add_answer(RR(request.q.qname, QTYPE.A, ttl=30, rdata=A(self.address)))
            # No AAAA/HTTPS record: do not accidentally reach the public server.
            return reply
        try:
            wire = request.send(self.upstream, 53, tcp=handler.protocol == 'tcp', timeout=3)
            result = DNSRecord.parse(wire)
            if result.header.tc and handler.protocol != 'tcp':
                result = DNSRecord.parse(request.send(self.upstream, 53, tcp=True, timeout=3))
            return result
        except (OSError, ValueError):
            reply.header.rcode = RCODE.SERVFAIL
            return reply


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--address', required=True)
    parser.add_argument('--domain', required=True)
    parser.add_argument('--upstream', required=True)
    args = parser.parse_args()
    ipaddress.ip_address(args.address)
    ipaddress.ip_address(args.upstream)
    if args.address == args.upstream:
        parser.error('Upstream must not point to this DNS listener')
    resolver = LocalResolver(args.domain, args.address, args.upstream)
    logger = DNSLogger(log='-request,-reply,-truncated,-error', prefix=False)
    udp = DNSServer(resolver, address=args.address, port=53, logger=logger)
    tcp = DNSServer(resolver, address=args.address, port=53, tcp=True, logger=logger)
    udp.start_thread()
    print(f'DNS ready: {args.domain} -> {args.address}; other names -> {args.upstream}', flush=True)
    try:
        tcp.start()
    finally:
        udp.stop()
