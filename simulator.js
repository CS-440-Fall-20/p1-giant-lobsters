"use strict";

var canvas;
var gl;
var program;

// Arrays to populate buffers
var points = [];
var normals = [];
var colours = []; 
var faces = {}; // dictionary for normal calculation of smooth shading

// GLobal buffers
var vertexBuffer;
var colourBuffer;
var normalBuffer;

//for flat shading
var lightPosition = vec4(1.0, 0.5, 1.0, 0.0 );
var lightAmbient = vec4(0.8, 0.8, 0.8, 1.0 );
var lightDiffuse = vec4( 1.0, 1.0, 1.0, 1.0 );
var lightSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );
var materialAmbient = vec4( 1.0, 1.0, 1.0, 1.0 );
var materialDiffuse = vec4( 1.0, 0.8, 0.0, 1.0 );
var materialSpecular = vec4( 1.0, 1.0, 1.0, 1.0 );
var materialShininess = 30.0;


//Viewing volume parameters
var near = -1;
var far = 10;
var radius = 4.5;
var theta = 90.0;
var phi = 0.0;

var left = -3.0;
var right = 3.0;
var ytop = 3.0;
var bottom = -3.0;

var eye;
var atVector = vec3(0.0, 3.0, 0.0);
var upVector = vec3(0.0, 1.0, 0.0);

//Shading
var flatShading = false;
var smoothShading = false;
var phongShading = false;

var changeShader = false; //check for switching between phong shading and the rest

// Views
var wireframe = true;
var pointsView = false;
var faceView = flatShading;

// Matrices
var modelViewMatrix, modelViewMatrixLoc;
var projectionMatrix, projectionMatrixLoc;
var normalMatrix, normalMatrixLoc;


// speed controls
var speed = 0.02;
var flyingOffset = 0;
var minAltitude = 2.8; // min altitude
var maxAltitude = 3.5; // max altitude
var S = 0.1; // max speed

var scale = 0.1; //arbitary scaling factor for wireframe


window.onload = function init() {

    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    gl.enable(gl.DEPTH_TEST);

    //
    //  Load shaders and initialize attribute buffers
    //
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);
    
    getPatch(-10,10,-10,10);

    initBuffers();
}

function initBuffers(){

    var ambientProd = mult(lightAmbient, materialAmbient);
	var diffuseProd = mult(lightDiffuse, materialDiffuse);
	var specularProd = mult(lightSpecular, materialSpecular);
    
    normalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
    var vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormal);

    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Load colours data into the GPU
    colourBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colourBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colours), gl.STATIC_DRAW);
    var vColour = gl.getAttribLocation(program, "vColour");
    gl.vertexAttribPointer(vColour, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColour);

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    normalMatrixLoc = gl.getUniformLocation(program, "normalMatrix");
    gl.uniform4fv( gl.getUniformLocation(program, "ambientProd"),flatten(ambientProd) );
	gl.uniform4fv( gl.getUniformLocation(program,"diffuseProd"),flatten(diffuseProd) );
	gl.uniform4fv( gl.getUniformLocation(program,"specularProd"),flatten(specularProd) );
	gl.uniform4fv( gl.getUniformLocation(program,"lightPosition"),flatten(lightPosition) );
	gl.uniform1f( gl.getUniformLocation(program,"shininess"),materialShininess );

    document.body.onkeydown = function (event) {
        event = event || window.event;
        var keycode = event.code;
        var shiftPressed = false;

        if (event.shiftKey) { shiftPressed = true; }

        varyView(keycode, shiftPressed);
        flightMotion(keycode);

        if(keycode === "Escape") //Quit the simulator 
        {
            window.close();
        }
    }
    render();
}

function getPatch(xmin, xmax, zmin, zmax) {
    
    noise.seed(10);

    for (var i = xmin; i < xmax; i += scale) {
        for (var j = zmin; j < zmax; j += scale) {
            if (wireframe){
                //basic mesh  (triangulated terrain )
                points.push(vec3(i, 0, j + scale));
                points.push(vec3(i, 0, j));
                points.push(vec3(i + scale, 0, j));

                points.push(vec3(i, 0, j + scale));
                points.push(vec3(i + scale, 0, j + scale));
                points.push(vec3(i, 0, j + scale));
            }
            else if(flatShading || smoothShading || faceView){
                points.push(vec3(i, 0, j));
				points.push(vec3(i, 0, j + scale));
				points.push(vec3(i + scale, 0, j));
				points.push(vec3(i + scale, 0, j + scale));
				points.push(vec3(i + scale, 0, j));
				points.push(vec3(i, 0, j + scale));	
            }
        }
        //randomly perturb y-coordinates - using perlin noise for smoother peaks
        for (var k = 0; k < points.length; k++) {
            points[k][1] = noise.perlin2(points[k][0], points[k][2]);
        }
    }
    helper();
}

function helper(){

    //For both flatShading and smoothShading the normals are generated
    if (flatShading || faceView){
        for (var i=1; i < points.length; i++){
            if (points[i] === undefined || points[i+1] === undefined){
                break;
            }
            var v1 = subtract(points[i], points[i-1]);
            var v2 = subtract(points[i+1], points[i-1]);
            var norm = normalize(cross(v2, v1));
            normals.push(vec4(norm));
        }
    }
    else if (smoothShading || phongShading){             
        var val = vec4(0, 0, 0, 0);
        var val1, val2, val3, val4;
        
        for (var key in faces){
            val1 = add(val, faces[key])[0]/3;
            val2 = add(val, faces[key])[1]/3;	
            val3 = add(val, faces[key])[2]/3;			
            val4 = add(val, faces[key])[3]/3;
            normals.push(vec4(val1,val2,val3,val4));
        }
    }
}


function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // adding the speed to the offset for perlin noise. (infinite view)
    flyingOffset += speed;
    noise.seed(10);

    colours = [];
    if (smoothShading || phongShading){
        normals = [];
    }
    for (var k = 0; k < points.length; k++) {
        points[k][1] = noise.perlin2(points[k][0] - flyingOffset, points[k][2]);

		if (flatShading || smoothShading || faceView || wireframe || phongShading){
            if (points[k][1] < -0.45){
                colours.push(vec4(0,0,1.0,1.0));        //blue
            }
            else if (points[k][1] >= -0.5 && points[k][1] < -0.15){
                colours.push(vec4(0.1,0.7,0,1.0));          ///green
            }
            else if( points[k][1] >= 0.4){
                colours.push(vec4(1, 1, 1, 1));            //white
            }
            else{
                colours.push(vec4(0.6,0.4,0.2,1));     ///brown
            }
        }	
	}


    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    gl.bindBuffer( gl.ARRAY_BUFFER, normalBuffer );
	gl.bufferData( gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW );
	gl.bindBuffer( gl.ARRAY_BUFFER, colourBuffer );
	gl.bufferData( gl.ARRAY_BUFFER, flatten(colours), gl.STATIC_DRAW );
    

    //Flyby View
    eye = vec3(radius * Math.cos(theta),radius * Math.sin(theta) * Math.cos(phi), radius * Math.sin(theta) * Math.sin(phi));

    modelViewMatrix = lookAt(eye, atVector, upVector);
    projectionMatrix = ortho(left, right, bottom, ytop, near, far); //orthographic view
    normalMatrix = [vec3(modelViewMatrix[0][0], modelViewMatrix[0][1], modelViewMatrix[0][2]),
        vec3(modelViewMatrix[1][0], modelViewMatrix[1][1], modelViewMatrix[1][2]),
        vec3(modelViewMatrix[2][0], modelViewMatrix[2][1], modelViewMatrix[2][2])];

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
    gl.uniformMatrix3fv( normalMatrixLoc, false, flatten(normalMatrix) );

    if(wireframe)
    {
        gl.drawArrays(gl.LINES, 0, points.length);
    }
    else if(pointsView)
    {
        gl.drawArrays(gl.POINTS, 0, points.length);
    }
    else if(flatShading || smoothShading || faceView || phongShading)
    {
        gl.drawArrays(gl.TRIANGLES, 0, points.length)
    }

    window.requestAnimFrame(render);
}


// ********************************************* View Controls ******************************************* //
/* vary view volume */
function varyView(keycode, shiftPressed) {
    var mode = (shiftPressed == true) ? "minus" : "add"; //true if shift key pressed 

    if (keycode === "Digit1") //1 or Shift+1
    {
        varyLeft(mode);
    }
    else if (keycode === "Digit2") //2 or Shift+2
    {
        varyRight(mode);
    }
    else if (keycode === "Digit3") //3 or Shift+3
    {
        varyTop(mode);
    }
    else if (keycode === "Digit4")//4 or Shift+4
    {
        varyBottom(mode);
    }
    else if (keycode === "Digit5")//5 or Shift+5
    {
        varyNear(mode);
    }
    else if (keycode === "Digit6") //6 or Shift+6
    {
        varyFar(mode);
    }
    else if(keycode === "KeyV") // Toggle views between wireframe, points and faces
    {
        toggleViews();
    }
    else if(keycode === "KeyC")
    {
        toggleShading();
    }
}


function varyLeft(mode) {
    if (mode === "add") {
        if(left <= -2)
        {left += 0.01;}
    }
    else {
        if(left > -4)
        { left -= 0.01; }
    }
}

function varyRight(mode) {
    if (mode == "add") {
        if(right < 4)
        { right += 0.01; }
    }
    else {
        if(right > 2)
        {  right -= 0.01;}
    }
}

function varyTop(mode) {
    if (mode == "add") {
        if(ytop < 4)
        {
            ytop += 0.01;
        }
    }
    else {
        if(ytop > 2)
        {
        ytop -= 0.01;
        }
    }
}

function varyBottom(mode) {
    if (mode == "add") {
        if(bottom > -4 )
        {  bottom -= 0.01; }
    }
    else 
    {
        if(bottom <= -2)
        { bottom += 0.01;}
    }

}

function varyNear(mode) {
    if (mode == "add") {

        if(near == -1)
        {
            near += 4; 
        }
        else if( near < 5 )
        { near += 1; }
    }
    else {
        if(near > -1 )
        {  near -= 1; } 
    }
}

function varyFar(mode) {
    if (mode == "add") {

        if (far < 12)
        {  far += 1; }
    }
    else {
        if (far > 8)
        {  far -= 1; }
    }
    
}


function toggleViews()
{
    if(wireframe)
    {
        wireframe = false;
        normals = [];
        pointsView = smoothShading = false;
        flatShading = faceView = true;
    }
    else if(pointsView)
    {
        wireframe = true;
        pointsView = false;
        flatShading = faceView = smoothShading = false;
    }
    else if(faceView || smoothShading || flatShading || phongShading){
        flatShading = faceView = smoothShading = phongShading = false;
        pointsView = true;
        wireframe = false;
    }
}

function toggleShading()
{
    if(wireframe){
        flatShading = faceView = true;
        smoothShading = wireframe = pointsView = false;
        normals = [];
        getPatch(-10,10,-10,10);
    }
    else if(flatShading || faceView){
        smoothShading = true;
        flatShading = wireframe = faceView = pointsView = false;
        normals = [];
        colours = [];
        points = [];
        getPatch(-10,10,-10,10);
        initBuffers();
    }
    else if(smoothShading){         
        phongShading = true;
        smoothShading = flatShading = faceView = pointsView = false;
        normals = [];
	changeShader = true;
        getPatch(-10,10,-10,10);
    }
    else if (phongShading){ 
	wireframe = true;
	phongShading = smoothShading = flatShading = faceView = pointsView = false;
        normals = [];
        changeShader = false;
        getPatch(-10,10,-10,10);
    }
}



// ********************************************* Flight Controls ******************************************* //

function flightMotion(e) {

    if (e == "ArrowUp")   //Accelerate 
    {
        if (speed < S)
            speed += 0.001;
    }
    else if (e == "ArrowDown")   //Decelerate
    {
        if (speed > 0)
            speed -= 0.001;
    }
    else if (e == "KeyW")   //Pitch-Up
    {
        if (atVector[1] <= maxAltitude) {
            atVector[1] += 0.01;
        }
        console.log(atVector);
    }
    else if (e == "KeyS")   //Pitch-Down
    {
        if (atVector[1] >= minAltitude)
            atVector[1] -= 0.01;
    }
    else if (e == "KeyD")   //Yaw-Right
    {
        if (atVector[2] <= 0.5)
            atVector[2] += 0.01;
    }
    else if (e == "KeyA")   //Yaw-Left
    {
        if (atVector[2] >= -0.5)
            atVector[2] -= 0.01;
    }
    else if (e == "KeyQ")   //Roll-Counter Clockwise
    {
        if (upVector[2] <= 1.0)
            upVector[2] += 0.01;
    }
    else if (e == "KeyE")   //Roll-Clockwise
    {
        if (upVector[2] >= -1.0)
            upVector[2] -= 0.01;
    }
}



/* References */
//  perlin.js used for perlin noise 
// Interactive Computer Graphics - A Top-Down Approach with WebGL (7th Edition)

