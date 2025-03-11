import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import './App.css';

// API base URL - make this configurable
const API_BASE_URL = 'http://localhost:5000';

function CADViewer() {
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('Upload a 3D model to begin');
  const [serverAvailable, setServerAvailable] = useState(false);
  const [exportFormat, setExportFormat] = useState('');
  
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const modelRef = useRef(null);

  // Check if server is available
  useEffect(() => {
    const checkServerStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'HEAD',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        setServerAvailable(response.ok || response.status === 405); // 405 = Method Not Allowed, but server is reachable
        console.log('Server is available');
      } catch (error) {
        console.warn('Server is not available:', error);
        setServerAvailable(false);
      }
    };
    
    checkServerStatus();
  }, []);

  // Setup the 3D scene
  useEffect(() => {
    // Initialize scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;
    cameraRef.current = camera;

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth * 0.8, window.innerHeight * 0.7);
    renderer.shadowMap.enabled = true;
    if (mountRef.current) {
      // Clear any existing renderer
      while (mountRef.current.firstChild) {
        mountRef.current.removeChild(mountRef.current.firstChild);
      }
      mountRef.current.appendChild(renderer.domElement);
    }
    rendererRef.current = renderer;

    // Store a reference to the current mount node for cleanup
    const currentMount = mountRef.current;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0xddeeff, 0x202020, 0.5);
    scene.add(hemisphereLight);

    // Add grid helper
    const gridHelper = new THREE.GridHelper(20, 20);
    gridHelper.material.opacity = 0.5;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Add axis helper
    const axisHelper = new THREE.AxesHelper(5);
    scene.add(axisHelper);

    // Add orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.2;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 1.2;
    controlsRef.current = controls;

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth * 0.8, window.innerHeight * 0.7);
    };
    
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (currentMount) {
        while (currentMount.firstChild) {
          currentMount.removeChild(currentMount.firstChild);
        }
      }
    };
  }, []);

  // Handle file upload
  const handleFileChange = (event) => {
    const uploadedFile = event.target.files[0];
    if (uploadedFile) {
      setFile(uploadedFile);
      
      const fileName = uploadedFile.name.toLowerCase();
      if (fileName.endsWith('.stl')) {
        setFileType('stl');
        // Set default export format to obj
        setExportFormat('obj');
        loadModelFromFile(uploadedFile, 'stl');
      } else if (fileName.endsWith('.obj')) {
        setFileType('obj');
        // Set default export format to stl
        setExportFormat('stl');
        loadModelFromFile(uploadedFile, 'obj');
      } else {
        setMessage('Unsupported file format. Please upload STL or OBJ files.');
        setFile(null);
        setExportFormat('');
      }
    }
  };

  // Handle file upload to server
  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first');
      return;
    }

    if (!serverAvailable) {
      setMessage('Server appears to be offline. File is displayed locally only.');
      return;
    }

    setLoading(true);
    setMessage('Uploading file to server...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
        // Adding these headers and credentials explicitly to help with CORS
        headers: {
          'Accept': 'application/json',
          // Don't set Content-Type when using FormData - browser will set it with boundary
        },
        credentials: 'include',
        mode: 'cors',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }

      const data = await response.json();
      setMessage(`File uploaded to server successfully! Filename: ${data.filename}`);
    } catch (error) {
      console.error('Upload error:', error);
      setMessage(`File displayed locally. Server upload error: ${error.message || 'Failed to connect to server'}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle export format change
  const handleExportFormatChange = (e) => {
    setExportFormat(e.target.value);
  };

  // Handle model export
  const handleExport = async () => {
    if (!file || !exportFormat || !serverAvailable) {
      setMessage(serverAvailable 
        ? 'Please select a file first' 
        : 'Server is offline. Export requires a server connection.');
      return;
    }

    setLoading(true);
    setMessage(`Converting ${fileType.toUpperCase()} to ${exportFormat.toUpperCase()}...`);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fromFormat', fileType);
    formData.append('toFormat', exportFormat);

    try {
      const response = await fetch(`${API_BASE_URL}/api/export`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        mode: 'cors',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status: ${response.status}`);
      }

      // Get the file from the response
      const blob = await response.blob();
      
      // Create a download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = downloadUrl;
      
      // Create a meaningful filename
      const originalName = file.name.split('.')[0];
      a.download = `${originalName}.${exportFormat}`;
      
      // Trigger the download
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      setMessage(`File successfully exported to ${exportFormat.toUpperCase()} format!`);
    } catch (error) {
      console.error('Export error:', error);
      setMessage(`Export failed: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  // Load model from file directly (client-side rendering)
  const loadModelFromFile = (file, type) => {
    // Clear previous model
    if (modelRef.current && sceneRef.current) {
      sceneRef.current.remove(modelRef.current);
      modelRef.current = null;
    }

    setLoading(true);
    setMessage('Loading 3D model...');

    const reader = new FileReader();
    
    reader.onload = (event) => {
      const result = event.target.result;
      
      try {
        if (type === 'stl') {
          const loader = new STLLoader();
          const geometry = loader.parse(result);
          
          // Create a material with more visible properties
          const material = new THREE.MeshPhongMaterial({ 
            color: 0x3a7ca5, 
            specular: 0x111111, 
            shininess: 30,
            flatShading: false
          });
          
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          
          // Center the model
          geometry.computeBoundingBox();
          const center = new THREE.Vector3();
          geometry.boundingBox.getCenter(center);
          mesh.position.sub(center);
          
          // Add the mesh to the scene
          if (sceneRef.current) {
            sceneRef.current.add(mesh);
            modelRef.current = mesh;
            
            // Adjust camera to fit model
            fitCameraToObject(mesh);
          }
          
          console.log('STL model loaded successfully');
        } else if (type === 'obj') {
          const loader = new OBJLoader();
          const object = loader.parse(result);
          
          // Apply better material to all meshes in the OBJ
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.material = new THREE.MeshPhongMaterial({ 
                color: 0x3a7ca5, 
                specular: 0x111111, 
                shininess: 30,
                flatShading: false
              });
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          // Center the model
          const box = new THREE.Box3().setFromObject(object);
          const center = new THREE.Vector3();
          box.getCenter(center);
          object.position.sub(center);
          
          // Add the object to the scene
          if (sceneRef.current) {
            sceneRef.current.add(object);
            modelRef.current = object;
            
            // Adjust camera to fit model
            fitCameraToObject(object);
          }
          
          console.log('OBJ model loaded successfully');
        }
        
        setMessage('Model loaded successfully!');
      } catch (error) {
        console.error('Error loading model:', error);
        setMessage(`Error loading model: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      setMessage('Error reading file');
      setLoading(false);
    };
    
    console.log('Loading file type:', type);
    if (type === 'stl') {
      reader.readAsArrayBuffer(file);
    } else if (type === 'obj') {
      reader.readAsText(file);
    }
  };

  // Fit camera to the loaded model
  const fitCameraToObject = (object) => {
    if (!object || !cameraRef.current || !controlsRef.current) return;
    
    // Create a bounding box
    const boundingBox = new THREE.Box3().setFromObject(object);
    
    // Ensure bounding box is valid
    if (boundingBox.isEmpty()) {
      console.warn('Bounding box is empty');
      return;
    }
    
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    // Compute the max side length (plus some margin)
    const maxDim = Math.max(size.x, size.y, size.z) * 1.5;
    
    const fov = cameraRef.current.fov * (Math.PI / 180);
    const cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    
    // Position camera at an angle for better initial view
    const direction = new THREE.Vector3(1, 0.5, 1).normalize();
    direction.multiplyScalar(cameraDistance);
    
    cameraRef.current.position.copy(center).add(direction);
    cameraRef.current.lookAt(center);
    
    controlsRef.current.target.copy(center);
    controlsRef.current.update();
    
    console.log('Camera fitted to object:', { center, size, distance: cameraDistance });
    
    // Force a render to update the view
    if (rendererRef.current && sceneRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  return (
    <div className="cad-app-container">
      <div className="app-header">
        <h1>3D CAD Viewer</h1>
        {!serverAvailable && (
          <div className="server-status-warning">
            Server is offline. Files will only be displayed locally.
          </div>
        )}
      </div>
      
      <div className="controls-panel">
        <div className="upload-section">
          <label className="file-input-label">
            <span>Choose File</span>
            <input
              type="file"
              onChange={handleFileChange}
              accept=".stl,.obj"
              disabled={loading}
              className="file-input"
            />
          </label>
          
          <button 
            className="action-button upload-button"
            onClick={handleUpload} 
            disabled={!file || loading || !serverAvailable}
          >
            {loading ? 'Processing...' : 'Upload to Server'}
          </button>
          
          {file && (
            <div className="export-options">
              <select 
                value={exportFormat} 
                onChange={handleExportFormatChange}
                disabled={!serverAvailable || loading}
                className="format-select"
              >
                <option value="">Select export format...</option>
                {fileType === 'stl' && <option value="obj">OBJ</option>}
                {fileType === 'stl' && <option value="stl">STL</option>}
                {fileType === 'obj' && <option value="stl">STL</option>}
                {fileType === 'obj' && <option value="obj">OBJ</option>}
              </select>
              
              <button 
                className="action-button export-button"
                onClick={handleExport} 
                disabled={loading || !serverAvailable || !exportFormat}
              >
                Export
              </button>
            </div>
          )}
        </div>
      </div>
      
      {message && (
        <div className={`message ${loading ? 'loading' : ''}`}>
          {loading && <div className="spinner"></div>}
          <p>{message}</p>
        </div>
      )}
      
      <div className="viewer-container" ref={mountRef}></div>
      
      <div className="instructions">
        <h3>Controls:</h3>
        <div className="controls-list">
          <div className="control-item">
            <span className="control-icon">Rotate</span>
            <span>Left-click and drag</span>
          </div>
          <div className="control-item">
            <span className="control-icon">Pan</span>
            <span>Right-click and drag</span>
          </div>
          <div className="control-item">
            <span className="control-icon">Zoom</span>
            <span>Scroll wheel</span>
          </div>
        </div>
        {file && (
          <div className="model-info">
            <h3>Model Info:</h3>
            <p>Current format: {fileType.toUpperCase()}</p>
            {serverAvailable && (
              <p>You can export this model to STL or OBJ format using the Export dropdown.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CADViewer;