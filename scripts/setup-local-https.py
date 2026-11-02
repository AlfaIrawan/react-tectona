"""Create development TLS credentials outside Git. Never distribute the private keys."""
import argparse
import datetime as dt
import hashlib
import ipaddress
import os
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--ip', required=True)
    args = parser.parse_args()
    address = ipaddress.ip_address(args.ip)
    directory = Path(os.environ['LOCALAPPDATA']) / 'Tectona' / 'dev-https'
    directory.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc)
    ca_key_file, ca_file = directory / 'ca-key.pem', directory / 'ca.pem'
    if ca_key_file.exists() != ca_file.exists():
        raise SystemExit('Incomplete CA files; restore the missing file before continuing.')
    if ca_file.exists():
        ca_key = serialization.load_pem_private_key(ca_key_file.read_bytes(), password=None)
        ca = x509.load_pem_x509_certificate(ca_file.read_bytes())
        if ca.not_valid_after_utc < now + dt.timedelta(days=91):
            raise SystemExit('Development CA expires soon; renew it explicitly and re-enroll test devices.')
    else:
        ca_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Tectona Local Development CA')])
        ca = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
              .public_key(ca_key.public_key()).serial_number(x509.random_serial_number())
              .not_valid_before(now - dt.timedelta(minutes=5)).not_valid_after(now + dt.timedelta(days=365))
              .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
              .add_extension(x509.KeyUsage(False, False, False, False, False, True, True, False, False), critical=True)
              .add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), critical=False)
              .sign(ca_key, hashes.SHA256()))
        ca_key_file.write_bytes(ca_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        ca_file.write_bytes(ca.public_bytes(serialization.Encoding.PEM))
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    cert = (x509.CertificateBuilder()
            .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, str(address))]))
            .issuer_name(ca.subject).public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(now - dt.timedelta(minutes=5)).not_valid_after(now + dt.timedelta(days=90))
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
            .add_extension(x509.SubjectAlternativeName([x509.IPAddress(address), x509.IPAddress(ipaddress.ip_address('127.0.0.1')), x509.DNSName('localhost')]), critical=False)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
            .add_extension(x509.KeyUsage(True, False, True, False, False, False, False, False, False), critical=True)
            .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
            .sign(ca_key, hashes.SHA256()))
    (directory / 'server-key.pem').write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    (directory / 'server.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    # Only the public CA certificate is made downloadable for device enrollment.
    public_ca = Path(__file__).resolve().parents[1] / 'public' / 'tectona-local-ca.cer'
    der = ca.public_bytes(serialization.Encoding.DER)
    public_ca.write_bytes(der)
    print(f'TLS directory: {directory}')
    print(f'Public CA: {public_ca}')
    print(f'CA SHA-256: {hashlib.sha256(der).hexdigest().upper()}')
    print(f'Local HTTPS URL: https://{address}:5443/login')


if __name__ == '__main__':
    main()
