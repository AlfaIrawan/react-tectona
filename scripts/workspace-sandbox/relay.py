"""Fixed TCP relay from Docker Desktop's loopback port proxy into an internal network."""

import selectors
import socket
import socketserver
from threading import Thread


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True
    allow_reuse_address = True


class Relay(socketserver.BaseRequestHandler):
    def handle(self):
        try:
            with socket.create_connection(self.server.target, timeout=5) as upstream:
                upstream.settimeout(90)
                self.request.settimeout(90)
                with selectors.DefaultSelector() as selector:
                    selector.register(self.request, selectors.EVENT_READ, upstream)
                    selector.register(upstream, selectors.EVENT_READ, self.request)
                    while selector.get_map():
                        ready = selector.select(timeout=90)
                        if not ready:
                            return
                        for source, _ in ready:
                            data = source.fileobj.recv(65536)
                            if data:
                                source.data.sendall(data)
                            else:
                                selector.unregister(source.fileobj)
                                source.data.shutdown(socket.SHUT_WR)
        except OSError:
            return


servers = []
for service, port in (("identity", 8430), ("org", 8424), ("wac", 8421)):
    server = Server(("0.0.0.0", port), Relay)
    server.target = (service, port)
    servers.append(Thread(target=server.serve_forever))
    servers[-1].start()

for thread in servers:
    thread.join()
