"""Build a public full chain outside the repository; never copy the private key."""
import os
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import serialization

source = Path.home() / 'Downloads'
cert_pem = (source / 'star_adira_co_id.pem').read_bytes()
bundle = (source / 'My_CA_Bundle.pem').read_bytes()
cert = x509.load_pem_x509_certificate(cert_pem)
key = serialization.load_pem_private_key((source / 'private.key').read_bytes(), password=None)
public = lambda value: value.public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
if public(key.public_key()) != public(cert.public_key()):
    raise SystemExit('TLS private key does not match certificate')
directory = Path(os.environ['LOCALAPPDATA']) / 'Tectona/dev-https'
directory.mkdir(parents=True, exist_ok=True)
target = directory / 'domain-fullchain.pem'
target.write_bytes(cert_pem.rstrip() + b'\n' + bundle.rstrip() + b'\n')
print('Public certificate chain prepared:', target)
