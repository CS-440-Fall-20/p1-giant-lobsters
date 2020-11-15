"use strict";

var canvas;
var gl;

// Arrays to populate buffers
var points = [];
var normals = [];
var colours = []; 

// GLobal buffers
var vertexBuffer;
var colourBuffer;

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

// views
var wireframe = true;
var pointsView = false;

var modelViewMatrix, modelViewMatrixLoc;
var projectionMatrix, projectionMatrixLoc;
var normalMatrix, normalMatrixLoc;


// speed controls
var speed = 0.02;
var flyingOffset = 0;
var minAltitude = 2.8; // min altitude
var maxAltitude = 3.5; // max altitude
var S = 0.1; // max speed

var color = vec4(1, 1, 1, 1); //colour of wireframe terrain (white)
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
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);


    
    getPatch(-10,10,-10,10);

    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    // normalMatrixLoc = gl.getUniformLocation(program, "normalMatrix");


    // Load colours data into the GPU
    colourBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colourBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colours), gl.STATIC_DRAW);

    var vColour = gl.getAttribLocation(program, "vColour");
    gl.vertexAttribPointer(vColour, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColour);


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
            //basic mesh  (triangulated terrain )
            points.push(vec3(i, 0, j + scale));
            points.push(vec3(i, 0, j));
            points.push(vec3(i + scale, 0, j));

            points.push(vec3(i, 0, j + scale));
            points.push(vec3(i + scale, 0, j + scale));
            points.push(vec3(i, 0, j + scale));

            colours.push(color);
            colours.push(color);
            colours.push(color);

            colours.push(color);
            colours.push(color);
            colours.push(color);

        }
        //randomly perturb y-coordinates - using perlin noise for smoother peaks
        for (var k = 0; k < points.length; k++) {
            points[k][1] = noise.perlin2(points[k][0], points[k][2]);
        }
    }
}



function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // adding the speed to the offset for perlin noise. (infinite view)
    flyingOffset += speed;
    noise.seed(10);

    for (var k = 0; k < points.length; k++) {
        points[k][1] = noise.perlin2(points[k][0] + flyingOffset, points[k][2]);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);
    

    //Flyby View
    eye = vec3(radius * Math.cos(theta),radius * Math.sin(theta) * Math.cos(phi), radius * Math.sin(theta) * Math.sin(phi));

    modelViewMatrix = lookAt(eye, atVector, upVector);
    projectionMatrix = ortho(left, right, bottom, ytop, near, far); //orthographic view

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
    // gl.uniformMatrix3fv( normalMatrixLoc, false, flatten(normalMatrix) );

    if(wireframe)
    {
        gl.drawArrays(gl.LINES, 0, points.length);
    }
    else if(pointsView)
    {
        gl.drawArrays(gl.POINTS, 0, points.length);
    }

    //TODO: Add Face view

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
    console.log(near, far);

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


// TODO:Add Shaded View 
function toggleViews()
{
    if(wireframe)
    {
        wireframe = false;
        pointsView = true;
    }
    else if(pointsView)
    {
        wireframe = true;
        pointsView = false;
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

