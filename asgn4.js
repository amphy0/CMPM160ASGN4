// ColoredPoint.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  attribute vec3 a_Normal;
  
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_VertPos;
  
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  uniform mat4 u_NormalMatrix;
  
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV; 
    v_Normal = normalize(vec3(u_NormalMatrix * vec4(a_Normal, 1.0)));
    v_VertPos = u_ModelMatrix * a_Position;
  }`

// Fragment shader program
var FSHADER_SOURCE =`
  precision mediump float;
  varying vec2 v_UV;
  varying vec3 v_Normal;
  varying vec4 v_VertPos;
  
  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  uniform sampler2D u_Sampler3;
  uniform sampler2D u_Sampler4;
  uniform int u_whichTexture;
  uniform vec3 u_lightPos;
  uniform vec3 u_cameraPos;
  uniform bool u_lightON;
  
  uniform vec3 u_lightColor;

  uniform vec3 u_spotDirection;
  uniform float u_spotCosineCutoff;
  uniform float u_spotExponent;
  uniform bool u_spotlightON;
  
  void main() {
    if (u_whichTexture == -2) {                     // Solid color
      gl_FragColor = u_FragColor;
    } else if (u_whichTexture == -1) {              // UV Debug color
      gl_FragColor = vec4(v_UV, 1.0, 1.0);
    } else if (u_whichTexture == 0) {               // texture 0
      gl_FragColor = texture2D(u_Sampler0, v_UV);
    } else if (u_whichTexture == 1) {               // texture 1
      gl_FragColor = vec4(0.4, 0.4, 0.4, 1.0) * texture2D(u_Sampler1, v_UV);   
    } else if (u_whichTexture == 2) {               // texture 2
      gl_FragColor = vec4(0.4, 0.4, 0.4, 1.0) * texture2D(u_Sampler2, v_UV);   
    } else if (u_whichTexture == 3) {               // texture 3
      gl_FragColor = texture2D(u_Sampler3, v_UV);   
    } else if (u_whichTexture == 4) {               // texture 4
      gl_FragColor = texture2D(u_Sampler4, v_UV);   
    } else {                                        
      gl_FragColor = vec4(1.0, 0.2, 0.2, 1.0);
    }

    vec3 lightVector = u_lightPos - vec3(v_VertPos);
    float r = length(lightVector);
    
    vec3 L = normalize(lightVector);
    vec3 N = normalize(v_Normal);
    float nDotL = max(dot(N, L), 0.0);
    
    // Reflection
    vec3 R = reflect(-L, N);
    
    // Eye
    vec3 E = normalize(u_cameraPos - vec3(v_VertPos));
    
    // Specular
    float specular = pow(max(dot(R, E), 0.0), 20.0) * 0.8;
    
    // Ambient and Diffuse
    vec3 diffuse = vec3(gl_FragColor) * u_lightColor * nDotL * 0.7;
    vec3 ambient = vec3(gl_FragColor) * 0.25;
    
    float spotFactor = 1.0;
    if (u_spotlightON) 
    {
      vec3 spotL = normalize(u_lightPos - vec3(v_VertPos));
      vec3 D = normalize(u_spotDirection);
      float spotCosine = dot(D, -L);
      
      if (spotCosine >= u_spotCosineCutoff) 
      {
        spotFactor = pow(spotCosine, u_spotExponent);
      } 
      else 
      {
        spotFactor = 0.0;
      }
    }
    if (u_lightON) 
    {
      vec3 diffuseWithSpot = diffuse * spotFactor;
      vec3 specularWithSpot = vec3(specular) * spotFactor * u_lightColor;
      gl_FragColor = vec4(specularWithSpot + diffuseWithSpot + ambient, 1.0);
    } 
    else 
    {
      // Your existing no-light case
      gl_FragColor = vec4(diffuse + ambient, 1.0);
    }
  }`

// Global variables
let canvas;
let gl;
let a_Position;
let a_UV;
let a_Normal;
let u_FragColor;
let u_ModelMatrix;
let u_GlobalRotateMatrix;
let u_ViewMatrix;
let u_ProjectionMatrix;
let u_NormalMatrix;
let u_Sampler0;
let u_Sampler1;
let u_Sampler2;
let u_Sampler3;
let u_Sampler4;
let u_whichTexture;
let u_lightPos;
let u_cameraPos;
let u_spotDirection;
let u_spotCosineCutoff;
let u_lightON;
let u_spotExponent;
let u_spotlightON;
let u_lightColor;

// 32x32 map for the scene
const g_map = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 5, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];


function setupWebGL() {
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  // gl = getWebGLContext(canvas);
  gl = canvas.getContext("webgl", {preserveDrawingBuffer:true});
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
  gl.enable(gl.DEPTH_TEST);
}

function connectVariablesToGLSL() {
  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

  // // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  if (a_UV < 0) {
    console.log('Failed to get the storage location of a_UV');
    return;
  }

  a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
  if (a_Normal < 0) {
    console.log('Failed to get the storage location of a_Normal');
    return;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log('Failed to get the storage location of u_ModelMatrix');
    return;
  }

  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  if (!u_GlobalRotateMatrix) {
    console.log('Failed to get the storage location of u_GlobalRotateMatrix');
    return;
  }

  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  if (!u_ViewMatrix) {
    console.log('Failed to get the storage location of u_ViewMatrix');
    return;
  }

  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  if (!u_ProjectionMatrix) {
    console.log('Failed to get the storage location of u_ProjectionMatrix');
    return;
  }

  u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');
  if (!u_NormalMatrix) {
    console.log('Failed to get the storage location of u_NormalMatrix');
    return;
  }

  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  if (!u_Sampler0) {
    console.log('Failed to get the storage location of u_Sampler');
    return false;
  }

  u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
  if (!u_Sampler1) {
    console.log('Failed to get the storage location of u_Sampler');
    return false;
  }

  u_Sampler2 = gl.getUniformLocation(gl.program, 'u_Sampler2');
  if (!u_Sampler2) {
    console.log('Failed to get the storage location of u_Sampler');
    return false;
  }

  u_Sampler3 = gl.getUniformLocation(gl.program, 'u_Sampler3');
  if (!u_Sampler3) {
    console.log('Failed to get the storage location of u_Sampler');
    return false;
  }

  u_Sampler4 = gl.getUniformLocation(gl.program, 'u_Sampler4');
  if (!u_Sampler4) {
    console.log('Failed to get the storage location of u_Sampler');
    return false;
  }

  u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
  if (!u_whichTexture) {
    console.log('Failed to get the storage location of u_whichTexture');
    return false;
  }

  u_lightPos = gl.getUniformLocation(gl.program, 'u_lightPos');
  if (!u_lightPos) {
    console.log('Failed to get the storage location of u_lightPos');
    return false;
  }

  u_cameraPos = gl.getUniformLocation(gl.program, 'u_cameraPos');
  if (!u_cameraPos) {
    console.log('Failed to get the storage location of u_cameraPos');
    return false;
  }

  u_lightON = gl.getUniformLocation(gl.program, 'u_lightON');
  if (!u_lightON) {
    console.log('Failed to get the storage location of u_lightON');
    return false;
  }

  u_spotDirection = gl.getUniformLocation(gl.program, 'u_spotDirection');
  if (!u_spotDirection) {
    console.log('Failed to get the storage location of u_spotDirection');
    return false;
  }

  u_spotCosineCutoff = gl.getUniformLocation(gl.program, 'u_spotCosineCutoff');
  if (!u_spotCosineCutoff) {
    console.log('Failed to get the storage location of u_spotCosineCutoff');
    return false;
  }

  u_spotExponent = gl.getUniformLocation(gl.program, 'u_spotExponent');
  if (!u_spotExponent) {
    console.log('Failed to get the storage location of u_spotExponent');
    return false;
  }

  u_spotlightON = gl.getUniformLocation(gl.program, 'u_spotlightON');
  if (!u_spotlightON) {
    console.log('Failed to get the storage location of u_spotlightON');
    return false;
  }

  u_lightColor = gl.getUniformLocation(gl.program, 'u_lightColor');
  if (!u_lightColor) {
    console.log('Failed to get the storage location of u_lightColor');
    return false;
  }

  let identityMatrix = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityMatrix.elements);
}

// Constants
const POINT = 0;
const TRIANGLE = 1;
const CIRCLE = 2;

// Global UI variables
let g_globalAngle = 0;
let camera;
let g_normalOn = false;
let g_lightPos = [0, 1, 1.1];
let g_lightON = true;
let g_spotDirection = [0.0, -1.0, 0.0];
let g_spotCosineCutoff = Math.cos(30 * Math.PI / 180);
let g_spotExponent = 10.0;
let g_spotlightON = false;
let g_lightColor = [1.0, 1.0, 1.0];

function addActionsforHtmlUI(){

  const angleSlider = document.getElementById('angleSlide');
  const angleDisplay = document.getElementById('angleValue');
  angleSlider.addEventListener('mousemove', function() {
    g_globalAngle = this.value;
    renderAllShapes();
    angleDisplay.textContent = this.value;
  });

  const fovSlider = document.getElementById('fovSlide');
  const fovDisplay = document.getElementById('fovValue');
  fovSlider.addEventListener('mousemove', function() {
    camera.updateProjectionMatrix(this.value);
    renderAllShapes();
    fovDisplay.textContent = this.value;
  });

  document.getElementById('normalOn').onclick = function() {
    g_normalOn = true;
    renderAllShapes();
  };
  document.getElementById('normalOff').onclick = function() {
    g_normalOn = false;
    renderAllShapes();
  }

  document.getElementById('lightOn').onclick = function() {
    g_lightON = true;
  }

  document.getElementById('lightOff').onclick = function() {
    g_lightON = false;
  }

  document.getElementById('spotlightOn').onclick = function() {
    g_spotlightON = true;
  }

  document.getElementById('spotlightOff').onclick = function() {
    g_spotlightON = false;
  }

  const spotSliderX = document.getElementById('spotlightXSlide');
  const spotDisplayX = document.getElementById('spotlightXValue');
  spotSliderX.addEventListener('mousemove', function() {
    g_spotDirection[0] = this.value/100;
    renderAllShapes();
    spotDisplayX.textContent = this.value/100;
  });

  const spotSliderY = document.getElementById('spotlightYSlide');
  const spotDisplayY = document.getElementById('spotlightYValue');
  spotSliderY.addEventListener('mousemove', function() {
    g_spotDirection[1] = this.value/100;
    renderAllShapes();
    spotDisplayY.textContent = this.value/100;
  });

  const spotSliderZ = document.getElementById('spotlightZSlide');
  const spotDisplayZ = document.getElementById('spotlightZValue');
  spotSliderZ.addEventListener('mousemove', function() {
    g_spotDirection[2] = this.value/100;
    renderAllShapes();
    spotDisplayZ.textContent = this.value/100;
  });

  const spotCutoffSlider = document.getElementById('spotlightCutoffSlide');
  const spotCutoffDisplay = document.getElementById('spotlightCutoffValue');
  spotCutoffSlider.addEventListener('mousemove', function() {
    g_spotCosineCutoff = Math.cos(this.value * Math.PI / 180);
    renderAllShapes();
    spotCutoffDisplay.textContent = this.value +  '°';
  });

  const spotExponentSlider = document.getElementById('spotExponentSlide');
  const spotExponentDisplay = document.getElementById('spotExponentValue');
  spotExponentSlider.addEventListener('mousemove', function() {
    g_spotExponent = this.value;
    renderAllShapes();
    spotExponentDisplay.textContent = this.value;
  });

  const lightColorSliderR = document.getElementById('lightRSlide');
  const lightColorDisplayR = document.getElementById('lightRValue');
  lightColorSliderR.addEventListener('mousemove', function() {
    g_lightColor[0] = this.value/100;
    renderAllShapes();
    lightColorDisplayR.textContent = this.value/100;
  });

  const lightColorSliderG = document.getElementById('lightGSlide');
  const lightColorDisplayG = document.getElementById('lightGValue');
  lightColorSliderG.addEventListener('mousemove', function() {
    g_lightColor[1] = this.value/100;
    renderAllShapes();
    lightColorDisplayG.textContent = this.value/100;
  });

  const lightColorSliderB = document.getElementById('lightBSlide');
  const lightColorDisplayB = document.getElementById('lightBValue');
  lightColorSliderB.addEventListener('mousemove', function() {
    g_lightColor[2] = this.value/100;
    renderAllShapes();
    lightColorDisplayB.textContent = this.value/100;
  });

  const lightSliderX = document.getElementById('lightXSlide');
  const lightDisplayX = document.getElementById('lightXValue');
  lightSliderX.addEventListener('mousemove', function() {
    g_lightPos[0] = this.value/100;
    renderAllShapes();
    lightDisplayX.textContent = this.value/100;
  });

  const lightSliderY = document.getElementById('lightYSlide');
  const lightDisplayY = document.getElementById('lightYValue');
  lightSliderY.addEventListener('mousemove', function() {
    g_lightPos[1] = this.value/100;
    renderAllShapes();
    lightDisplayY.textContent = this.value/100;
  });

  const lightSliderZ = document.getElementById('lightZSlide');
  const lightDisplayZ = document.getElementById('lightZValue');
  lightSliderZ.addEventListener('mousemove', function() {
    g_lightPos[2] = this.value/100;
    renderAllShapes();
    lightDisplayZ.textContent = this.value/100;
  });

}

function addKeyboardEvents() {
  document.addEventListener('keydown', (ev) => {
    switch(ev.code) {
      case 'KeyW':
        camera.moveForward();
        break;
      case 'KeyS':
        camera.moveBackwards();
        break;
      case 'KeyA':
        camera.moveLeft();
        break;
      case 'KeyD':
        camera.moveRight();
        break;
      case 'KeyQ':
        camera.panLeft();
        break;
      case 'KeyE':
        camera.panRight();
        break;
    }
    renderAllShapes();
  });
}

let isDragging = false;
let lastX = -1;
let lastY = -1;

function addMouseEvents() {
  canvas.onmousedown = function(ev) {
    if (ev.buttons === 1) { // Left mouse button
      isDragging = true;
      lastX = ev.clientX;
      lastY = ev.clientY;
    }
  };

  canvas.onmouseup = function(ev) {
    isDragging = false;
  };

  canvas.onmousemove = function(ev) {
    if (isDragging) {
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;

      const sensitivity = 0.3;

      const moveX = dx * sensitivity;
      const moveY = dy * sensitivity;

      if (moveX > 0) {
        camera.panRight(moveX);
      } else if (moveX < 0) {
        camera.panLeft(-moveX);
      }

      if (moveY > 0) {
        camera.panDown(moveY);
      } else if (moveY < 0) {
        camera.panUp(-moveY);
      }

      lastX = ev.clientX;
      lastY = ev.clientY;

      renderAllShapes();
    }
  };

  canvas.oncontextmenu = function(ev) {
    ev.preventDefault();
    return false;
  };
}

function initTextures() {

  let image0 = new Image();
  if (!image0) {
    console.log('Failed to create the image object');
    return false;
  }
  image0.onload = function() {
    console.log('Sky loaded');
    sendImageToTEXTURE0(image0);
  };
  image0.src = 'sky.jpg';

  let image1 = new Image();
  if (!image1) {
    console.log('Failed to create the image object');
    return false;
  }
  image1.onload = function() {
    console.log('Grass loaded');
    sendImageToTEXTURE1(image1);
  };
  image1.src = 'grass.png';

  let image2 = new Image();
  if (!image2) {
    console.log('Failed to create the image object');
    return false;
  }
  image2.onload = function() {
    console.log('Wall loaded');
    sendImageToTEXTURE2(image2);
  };
  image2.src = 'wall.png';

  let image3 = new Image();
  if (!image3) {
    console.log('Failed to create the image object');
    return false;
  }
  image3.onload = function() {
    console.log('Tree loaded');
    sendImageToTEXTURE3(image3);
  };
  image3.src = 'tree.png';

  let image4 = new Image();
  if (!image4) {
    console.log('Failed to create the image object');
    return false;
  }
  image4.onload = function() {
    console.log('Leaves loaded');
    sendImageToTEXTURE4(image4);
  };
  image4.src = 'leaf.png';

  return true;
}

function sendImageToTEXTURE0(image) {

  let texture = gl.createTexture();
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit 0
  gl.activeTexture(gl.TEXTURE0);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Write the image data to the texture object
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Pass the texture unit 0 to u_Sampler
  gl.uniform1i(u_Sampler0, 0);

  console.log('Texture loaded');
}

function sendImageToTEXTURE1(image) {

  let texture = gl.createTexture();
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit 1
  gl.activeTexture(gl.TEXTURE1);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Write the image data to the texture object
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Pass the texture unit 1 to u_Sampler
  gl.uniform1i(u_Sampler1, 1);

  console.log('Texture loaded');
}

function sendImageToTEXTURE2(image) {

  let texture = gl.createTexture();
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit 2
  gl.activeTexture(gl.TEXTURE2);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Write the image data to the texture object
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Pass the texture unit 2 to u_Sampler
  gl.uniform1i(u_Sampler2, 2);

  console.log('Texture loaded');
}

function sendImageToTEXTURE3(image) {
  let texture = gl.createTexture();
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit 3
  gl.activeTexture(gl.TEXTURE3);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Write the image data to the texture object
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Pass the texture unit 3 to u_Sampler
  gl.uniform1i(u_Sampler3, 3);

  console.log('Texture loaded');
}

function sendImageToTEXTURE4(image) {
  let texture = gl.createTexture();
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit 4
  gl.activeTexture(gl.TEXTURE4);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Write the image data to the texture object
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Pass the texture unit 4 to u_Sampler
  gl.uniform1i(u_Sampler4, 4);

  console.log('Texture loaded');
}

function main() {
  camera = new Camera();
  setupWebGL();
  connectVariablesToGLSL();

  addActionsforHtmlUI();
  addKeyboardEvents();
  addMouseEvents();

  initTextures();

  // Specify the color for clearing <canvas>
  gl.clearColor(0.5, 0.5,  0.5, 1.0);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  renderAllShapes();
  requestAnimationFrame(tick);
}

let g_startTime = performance.now()/1000.0;
let g_seconds = performance.now()/1000.0 - g_startTime;

function tick() {
  g_seconds = performance.now()/1000.0 - g_startTime;
  renderAllShapes();
  requestAnimationFrame(tick);
}

function updateAnimationAngles() {

  g_lightPos[0] = Math.cos(g_seconds);

}


function convertCoordinatesEvenToGL(ev){
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);

  return ([x, y]);
}

function drawMap() {
  for (let x = 0; x < g_map.length; x++) { // Ensure x stays in bounds
    for (let y = 0; y < g_map[x].length; y++) { // Ensure y stays in bounds
      if (g_map[x][y] === 1) {  // Only process if defined
        var cube = new Cube();
        cube.color = [0.5, 0.5, 0.5, 1];
        cube.textureNum = 2;
        cube.matrix.scale(1, 5, 1);
        cube.matrix.translate(x - 10, -0.15, y - 4);
        cube.renderfaster();
      }
      else if (g_map[x][y] === 2) {
        var cube = new Cube();
        cube.color = [0.4, 0.2, 0.1, 1];
        cube.textureNum = -2;
        cube.matrix.translate(x - 10, -1.0, y - 4);
        cube.renderfaster();
      }
      else if (g_map[x][y] === 3) {
        var cube = new Cube();
        cube.color = [0.2, 0.2, 0.2, 1];
        cube.textureNum = 1;
        cube.matrix.translate(x - 10, -1.4, y - 4);
        cube.renderfaster();
      }
      else if (g_map[x][y] === 4) {
        var cube = new Cube();
        cube.color = [0.8, 0.8, 0.8, 1];
        cube.textureNum = -2;
        cube.matrix.translate(x - 10, -1.3, y - 4);
        cube.renderfaster();
      }
      else if (g_map[x][y] === 5) {
        for (let i = 0; i < 6; i++) {
          var cube = new Cube();
          cube.color = [0.2, 0.8, 0.2, 1];
          cube.textureNum = 3;
          cube.matrix.translate(x - 10, -1.3 + i * 0.5, y - 4);
          cube.renderfaster();
        }
        const leafPatterns = [
          // Bottom layer (3x3, no corners)
          [
            [-1, 0], [0, -1], [0, 0], [0, 1], [1, 0]
          ],
          // Middle layer (3x3, all blocks)
          [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],  [0, 0],  [0, 1],
            [1, -1],  [1, 0],  [1, 1]
          ],
          // Top layer (plus shape)
          [
            [0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]
          ],
          [
            [0,0]
          ]
        ];
        leafPatterns.forEach((pattern, layerIndex) => {
          pattern.forEach(([dx, dz]) => {
            var leaves = new Cube();
            leaves.color = [0.2, 0.8, 0.2, 1];
            leaves.textureNum = 4;
            leaves.matrix.translate(
                (x + dx) - 10,
                -1.3 + 4 * 0.5 + layerIndex * 0.5,
                (y + dz) - 4
            );
            leaves.renderfaster();
          });
        });
      }
    }
  }
}

function normalizeSpotDirection(direction) {
  const length = Math.sqrt(
      direction[0] * direction[0] +
      direction[1] * direction[1] +
      direction[2] * direction[2]
  );

  if (length > 0) {
    return [
      direction[0] / length,
      direction[1] / length,
      direction[2] / length
    ];
  }

  return [0, -1, 0]; // Default down if zero length
}

function renderAllShapes(){

  // Get start time
  var startTime = performance.now();

  // Set the view matrix
  gl.uniformMatrix4fv(u_ViewMatrix, false, camera.viewMatrix.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, camera.projectionMatrix.elements);

  var globalRotMat = new Matrix4().rotate(g_globalAngle, 0, 1, 0);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Floor
  var floor = new Cube();
  floor.color = [.76, .70, .50, 1];
  floor.textureNum = -2;
  floor.matrix.translate(0.0, -0.75, 0.0);
  floor.matrix.scale(45.0, 0.00, 55.0);
  floor.matrix.translate(-0.5, 0.0, -0.5);
  floor.renderfast();

  // Sky
  var sky = new Cube();
  sky.color = [1.0, 0.0, 0.0, 1.0];
  sky.textureNum = 0;
  sky.matrix.translate(-1,0,-1);
  sky.matrix.scale(1000,1000,1000);
  sky.matrix.translate(-.3,-.5,-.3);
  sky.renderfaster();

  gl.uniform3f(u_lightColor, g_lightColor[0], g_lightColor[1], g_lightColor[2]);
  gl.uniform3f(u_lightPos, g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  gl.uniform3f(u_cameraPos, camera.eye.elements[0], camera.eye.elements[1], camera.eye.elements[2]);
  gl.uniform1i(u_lightON, g_lightON);

  const normalizedSpotDir = normalizeSpotDirection(g_spotDirection);
  gl.uniform3f(u_spotDirection, normalizedSpotDir[0], normalizedSpotDir[1], normalizedSpotDir[2]);
  gl.uniform1f(u_spotCosineCutoff, g_spotCosineCutoff);
  gl.uniform1f(u_spotExponent, g_spotExponent);
  gl.uniform1i(u_spotlightON, g_spotlightON);
  
  // Draw the map
  drawMap();

  var light = new Cube();
  light.color = [2, 2, 0, 1];
  light.matrix.translate(g_lightPos[0], g_lightPos[1], g_lightPos[2]);
  light.matrix.scale(-0.1, -0.1, -0.1);
  light.matrix.translate(-0.5, -0.5, -0.5);
  light.render();

  var sphere = new Sphere();
  sphere.color = [1.0, 0.0, 0.0, 1.0];
  sphere.matrix.translate(1, 0, 2);
  sphere.matrix.scale(0.5, 0.5, 0.5);
  if (g_normalOn) {sphere.textureNum = -3;}
  sphere.render();

  var cube = new Cube();
  cube.color = [0.0, 1.0, 0.0, 1.0];
  cube.matrix.translate(-2, -0.5, 2);
  if (g_normalOn) {cube.textureNum = -3;}
  cube.render();
  
  var duration = performance.now() - startTime;
  sendTextToHTML(" ms: " + Math.floor(duration) + " fps: " + Math.floor(10000/duration)/10, "numdot");
}

// Set text of a HTML element
function sendTextToHTML(text, htmlID) {
  var htmlElm = document.getElementById(htmlID);
  if (!htmlElm) {
    console.log('Failed to retrieve the <' + htmlID + '> element');
    return;
  }
  htmlElm.innerHTML = text;
}