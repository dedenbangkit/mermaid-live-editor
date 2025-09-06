from flask import Flask, request, jsonify, send_from_directory
import os
import json
from datetime import datetime

app = Flask(__name__)

SAVED_FILES_DIR = 'saved_files'
os.makedirs(SAVED_FILES_DIR, exist_ok=True)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/files', methods=['GET'])
def get_files():
    files = []
    for filename in os.listdir(SAVED_FILES_DIR):
        if filename.endswith('.json'):
            filepath = os.path.join(SAVED_FILES_DIR, filename)
            with open(filepath, 'r') as f:
                data = json.load(f)
                files.append({
                    'id': filename[:-5],
                    'name': data.get('name', filename[:-5]),
                    'created': data.get('created', '')
                })
    return jsonify(files)

@app.route('/api/files/<file_id>', methods=['GET'])
def get_file(file_id):
    filepath = os.path.join(SAVED_FILES_DIR, f"{file_id}.json")
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            return jsonify(json.load(f))
    return jsonify({'error': 'File not found'}), 404

@app.route('/api/files', methods=['POST'])
def save_file():
    try:
        data = request.json
        if not data:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        # Generate new ID if none provided or if ID is None/null
        file_id = data.get('id')
        if file_id is None or file_id == 'null' or file_id == '':
            file_id = str(int(datetime.now().timestamp() * 1000))  # Use milliseconds for better uniqueness
        
        # For new files, check if name is provided
        file_name = data.get('name', f'Diagram {file_id}')
        if not file_name or file_name == 'Untitled Diagram':
            file_name = f'Diagram {file_id}'
        
        file_data = {
            'id': file_id,
            'name': file_name,
            'content': data.get('content', ''),
            'created': data.get('created', datetime.now().isoformat())
        }
        
        filepath = os.path.join(SAVED_FILES_DIR, f"{file_id}.json")
        
        with open(filepath, 'w') as f:
            json.dump(file_data, f, indent=2)
        
        print(f"File saved successfully: {filepath}")  # Debug log
        return jsonify({'success': True, 'id': file_id})
        
    except Exception as e:
        print(f"Error saving file: {str(e)}")  # Debug log
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/files/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    filepath = os.path.join(SAVED_FILES_DIR, f"{file_id}.json")
    if os.path.exists(filepath):
        os.remove(filepath)
        return jsonify({'success': True})
    return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)