import http.server
import ssl
import sys
import os

# Default port
PORT = 8443
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        pass

# Ensure SSL certificates exist
if not os.path.exists('cert.pem') or not os.path.exists('key.pem'):
    print("SSL Certificates not found!")
    print("Please generate self-signed certificates first using this command:")
    print("  openssl req -new -x509 -keyout key.pem -out cert.pem -days 365 -nodes -subj '/CN=localhost'")
    sys.exit(1)

class SecureHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable caching during dev if preferred
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

server_address = ('0.0.0.0', PORT)
httpd = http.server.HTTPServer(server_address, SecureHTTPRequestHandler)

# Wrap socket with SSL Context
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile='cert.pem', keyfile='key.pem')
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print(f"🔒 Secure Server running at https://localhost:{PORT}")
print("Press Ctrl+C to stop.")

try:
    httpd.serve_forever()
except KeyboardInterrupt:
    print("\nShutting down server.")
    httpd.server_close()
