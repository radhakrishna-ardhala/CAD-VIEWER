from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import tempfile
import uuid
from werkzeug.utils import secure_filename
import trimesh
import logging

app = Flask(__name__)
# Enhanced CORS configuration
CORS(app, supports_credentials=True, resources={r"/api/*": {"origins": "*"}})

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Setup upload folder
UPLOAD_FOLDER = os.path.join(tempfile.gettempdir(), 'cad_viewer_uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

ALLOWED_EXTENSIONS = {'stl', 'obj'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload', methods=['POST', 'HEAD', 'OPTIONS'])
def upload_file():
    # Handle preflight requests
    if request.method == 'OPTIONS':
        return '', 204
    
    # Provide a simple HEAD response to check if server is alive
    if request.method == 'HEAD':
        return '', 200
    
    # Log the request details
    logger.info(f"Received upload request. Content-Type: {request.content_type}")
    logger.info(f"Headers: {dict(request.headers)}")
    
    if 'file' not in request.files:
        logger.warning("No file part in the request")
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        logger.warning("No selected file")
        return jsonify({'error': 'No selected file'}), 400
    
    if not allowed_file(file.filename):
        logger.warning(f"File type not allowed: {file.filename}")
        return jsonify({'error': 'File type not allowed'}), 400
    
    try:
        # Generate a secure unique filename
        original_filename = secure_filename(file.filename)
        file_extension = original_filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{file_extension}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        
        # Save the file
        file.save(filepath)
        logger.info(f"File saved successfully: {filepath}")
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': unique_filename
        }), 200
    
    except Exception as e:
        logger.error(f"Error during file upload: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/models/<filename>', methods=['GET'])
def get_model(filename):
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    
    if not os.path.exists(filepath):
        logger.warning(f"File not found: {filepath}")
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(filepath)

@app.route('/api/export', methods=['POST'])
def export_model():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    from_format = request.form.get('fromFormat', '')
    to_format = request.form.get('toFormat', '')
    
    if file.filename == '' or not from_format or not to_format:
        return jsonify({'error': 'Missing file or format information'}), 400
    
    if from_format not in ALLOWED_EXTENSIONS or to_format not in ALLOWED_EXTENSIONS:
        return jsonify({'error': 'Unsupported file format'}), 400
    
    temp_input_path = None
    temp_output_path = None
    
    try:
        # Save the uploaded file to a temporary location
        temp_input_path = os.path.join(app.config['UPLOAD_FOLDER'], f"temp_input_{uuid.uuid4().hex}.{from_format}")
        file.save(temp_input_path)
        
        # Create a unique output filename
        output_filename = f"export_{uuid.uuid4().hex}.{to_format}"
        temp_output_path = os.path.join(app.config['UPLOAD_FOLDER'], output_filename)
        
        # Load and convert the model
        mesh = trimesh.load(temp_input_path)
        
        # Export in the requested format
        if to_format == 'stl':
            mesh.export(temp_output_path, file_type='stl')
        elif to_format == 'obj':
            mesh.export(temp_output_path, file_type='obj')
        
        # Send the converted file
        return send_file(
            temp_output_path,
            as_attachment=True,
            download_name=f"model.{to_format}",
            mimetype=f'application/octet-stream'
        )
    
    except Exception as e:
        logger.error(f"Error during export: {str(e)}", exc_info=True)
        return jsonify({'error': str(e)}), 500
    
    finally:
        # Clean up temporary files
        try:
            if temp_input_path and os.path.exists(temp_input_path):
                os.remove(temp_input_path)
            if temp_output_path and os.path.exists(temp_output_path):
                # Only remove after sending - typically handled by Flask
                pass
        except Exception:
            pass

@app.route('/api/status', methods=['GET'])
def server_status():
    """Simple endpoint to check if server is running"""
    return jsonify({'status': 'online'}), 200

if __name__ == '__main__':
    logger.info(f"Starting server. Upload folder: {UPLOAD_FOLDER}")
    # Set threaded=True for better handling of concurrent requests
    app.run(debug=True, threaded=True, host='0.0.0.0', port=5000)