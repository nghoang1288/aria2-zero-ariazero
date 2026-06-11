from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import shutil
import os

class DiskSpaceHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def check_auth(self):
        secret = os.environ.get('ARIA2_RPC_SECRET')
        if not secret:
            return True
        
        auth_header = self.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            self.send_response(401)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Unauthorized"}).encode('utf-8'))
            return False
        
        token = auth_header[7:]
        if token != secret:
            self.send_response(401)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Unauthorized"}).encode('utf-8'))
            return False
        
        return True

    def do_GET(self):
        if self.path == '/api/disk':
            if not self.check_auth():
                return
            try:
                # Query disk usage for the /downloads mount
                total, used, free = shutil.disk_usage("/downloads")
                data = {
                    "total": total,
                    "used": used,
                    "free": free
                }
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(data).encode('utf-8'))
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/api/delete-files':
            if not self.check_auth():
                return
            try:
                content_length_str = self.headers.get('Content-Length')
                if content_length_str:
                    try:
                        content_length = int(content_length_str)
                    except ValueError:
                        content_length = 0
                else:
                    content_length = 0

                if content_length > 1048576:
                    self.send_response(413)
                    self.send_header('Content-Type', 'application/json')
                    self._send_cors_headers()
                    self.end_headers()
                    self.wfile.write(json.dumps({"error": "Payload too large"}).encode('utf-8'))
                    return

                post_data = self.rfile.read(content_length)
                req_data = json.loads(post_data.decode('utf-8'))
                file_paths = req_data.get("files", [])
                
                deleted_paths = []
                errors = []
                
                downloads_dir = os.path.realpath("/downloads")
                
                for path in file_paths:
                    if not path:
                      continue
                      
                    # Security checks: ensure path starts with /downloads
                    # Normalizing path using realpath
                    real_path = os.path.realpath(path)
                    
                    if not real_path.startswith(downloads_dir):
                        errors.append(f"Forbidden path: {path}")
                        continue
                        
                    if os.path.exists(real_path) or os.path.islink(real_path):
                        try:
                            if os.path.islink(real_path):
                                os.unlink(real_path)
                                deleted_paths.append(real_path)
                            elif os.path.isdir(real_path):
                                shutil.rmtree(real_path)
                                deleted_paths.append(real_path)
                            else:
                                os.remove(real_path)
                                deleted_paths.append(real_path)
                                
                                # Clean up parent directory if empty (and not /downloads itself)
                                parent = os.path.dirname(real_path)
                                if parent != downloads_dir and parent.startswith(downloads_dir + os.sep) and os.path.exists(parent) and not os.listdir(parent):
                                    shutil.rmtree(parent)
                                    deleted_paths.append(parent)
                        except Exception as file_err:
                            errors.append(f"Error deleting {path}: {str(file_err)}")
                            
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({
                    "deleted": deleted_paths,
                    "errors": errors
                }).encode('utf-8'))
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

def run(port=8080):
    server_address = ('127.0.0.1', port)
    httpd = ThreadingHTTPServer(server_address, DiskSpaceHandler)
    print(f"Starting disk space API on port {port}...")
    httpd.serve_forever()

if __name__ == '__main__':
    run()
