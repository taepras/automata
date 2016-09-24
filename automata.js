// config
var stateRadius = 30;
var arrowLength = 20;
var arrowWidth = 10;
var alphabetOffset = 10;

var canvas = document.getElementById('canvas');

window.onload = window.onresize = function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function dist(dx, dy) {
	return Math.sqrt(dx * dx + dy * dy);
}

function angleDiff(a1, a2) {
	return Math.abs((a1 - a2 + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
}

function isInside(angle, sAngle, eAngle) {
	var ds = angleDiff(sAngle, angle);
	var de = angleDiff(eAngle, angle);
	var d =  angleDiff(sAngle, eAngle);
	if (d <= 0.0001)
		return true;
	return Math.abs(de + ds - d) <= 0.001
}

function getArcInfo(x1, y1, x2, y2, r = -1) {
	var dx = x1 - x2;
    var dy = y1 - y2;
    if (dx === 0 && dy === 0) {
        var rr = 40
        var xc = x1;
        var yc = y1 - 40;
        return {
            xc: xc,
            yc: yc,
            r: rr,
            sAngle: -3 * Math.PI / 2,
            eAngle: Math.PI / 2
        };
    }

    var dSq = dx * dx + dy * dy;
    var d = Math.sqrt(dSq);
    if (r < 0)
        r = d;

    var LSq = r * r - (dSq / 4);
    var L = Math.sqrt(LSq);

    var vx1 = -dy * L / d;
    var vy1 = dx * L / d;
    var vx2 = dy * L / d;
    var vy2 = -dx * L / d;

    var xp = (x1 + x2) / 2;
    var yp = (y1 + y2) / 2;

    var xc1 = xp + vx1;
    var yc1 = yp + vy1;
    var xc2 = xp + vx2;
    var yc2 = yp + vy2;

    var startAngle1 = Math.atan2(y1 - yc1, x1 - xc1);
    var endAngle1 = Math.atan2(y2 - yc1, x2 - xc1);
    var startAngle2 = Math.atan2(y1 - yc2, x1 - xc2);
    var endAngle2 = Math.atan2(y2 - yc2, x2 - xc2);

    var arcInfo;
    if (endAngle1 - startAngle1 < Math.PI && endAngle1 - startAngle1 >= 0) {
        arcInfo = {
            xc: xc1,
            yc: yc1,
            r: r,
            sAngle: startAngle1,
            eAngle: endAngle1
        };
    } else {
        arcInfo = {
            xc: xc2,
            yc: yc2,
            r: r,
            sAngle: startAngle2,
            eAngle: endAngle2
        };
    }

    return arcInfo;
}

function drawArc(context, x1, y1, x2, y2, r = -1) {
    var arcInfo = getArcInfo(x1, y1, x2, y2, r);
    context.beginPath();
    context.arc(arcInfo.xc, arcInfo.yc, arcInfo.r,
		arcInfo.sAngle, arcInfo.eAngle);
    context.stroke();
	return arcInfo;
}

function drawCircle(context, cx, cy, r, w = 2,
    fill = false, fillStyle = '#ffffff', strokeStyle = '#000000') {
    context.beginPath();
    context.arc(cx, cy, r, 0, 2 * Math.PI, false);
    if (fill) {
        context.fillStyle = fillStyle;
        context.fill();
    }
    context.lineWidth = w;
    context.strokeStyle = strokeStyle;
    context.stroke();
}

function drawTriangleOnArc(context, arcInfo, hAngle, cw = true, offset = arrowWidth) {
	var hx = arcInfo.xc + arcInfo.r * Math.cos(hAngle);
	var hy = arcInfo.yc + arcInfo.r * Math.sin(hAngle);
	var dTheta = cw ? arrowLength / arcInfo.r : -arrowLength / arcInfo.r;
	var hxInner = arcInfo.xc + (arcInfo.r - offset) * Math.cos(hAngle - dTheta);
	var hyInner = arcInfo.yc + (arcInfo.r - offset) * Math.sin(hAngle - dTheta);
	var hxOuter = arcInfo.xc + (arcInfo.r + offset) * Math.cos(hAngle - dTheta);
	var hyOuter = arcInfo.yc + (arcInfo.r + offset) * Math.sin(hAngle - dTheta);
	context.strokeStyle = '#000000';
	context.beginPath();
	context.moveTo(hxInner, hyInner);
	context.lineTo(hx, hy);
	context.lineTo(hxOuter, hyOuter);
	context.stroke();
}

class Node {
    constructor(context, name = 'q', x = 100, y = 100) {
		this.context = context;
		this.name = name;
        this.x = x;
        this.y = y;
		this.r = stateRadius;
        this.isAccepting = false;
		this.isActive = false;
    }

    draw() {
		drawCircle(this.context, this.x, this.y, this.r, 2,
			true, this.isActive ? '#ffff00' : '#ffffff');
        if (this.isAccepting)
            drawCircle(this.context, this.x, this.y, this.r - 6);
        this.context.font = '20px Arial';
        this.context.textAlign = 'center';
        this.context.fillStyle = '#000000';
        this.context.fillText(this.name, this.x, this.y);
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    contains(x, y) {
        var dx = x - this.x;
        var dy = y - this.y
        return dx * dx + dy * dy < this.r * this.r;
    }
}

class Automata {
    constructor(context) {
        var startingNode = new Node(context, 'qi');
        startingNode.isAccepting = false;
        this.context = context;
        this.nodes = [startingNode];
        this.isRunning = false;
        this.currentStates = new Set();
        this.startingState = 0;
        this.nodeCount = 1;
        this.transitions = {};
    }

	reset() {
		this.currentStates.clear();
		this.updateActiveStates();
	}

    addTransition(source, alphabet, target) {
        console.log('add link from ' + source + ' to ' + target + ' by ' + alphabet);
        if (typeof this.transitions[source] === 'undefined')
            this.transitions[source] = {};
        if (typeof this.transitions[source][alphabet] === 'undefined')
            this.transitions[source][alphabet] = new Set();
        this.transitions[source][alphabet].add(target);
    }

    createNode(x = 100, y = 100) {
        var node = new Node(this.context, 'q' + this.nodeCount, x, y);
        this.nodeCount++;
        this.nodes.push(node);
        return this.nodeCount - 1; // return index of the node
    }

    addNode(node) {
        this.nodes.push(node);
    }

	removeNode(index) {
		// delete links the node
        delete this.nodes[index];
        // delete links FROM the node
        delete this.transitions[index];
        // delete links TO the node
        for (source in this.transitions) {
            for (var alphabet in this.transitions[source]) {
                this.transitions[source][alphabet].delete(index);
            }
        }
	}

	removeTransitions(source, target) {
        for (var alphabet in this.transitions[source]) {
            this.transitions[source][alphabet].delete(target);
        }
	}

    run(input) {
        this.currentStates.clear();
        this.currentStates.add(this.startingState);
		this.updateActiveStates();
        for (var i = 0; i < input.length; i++) {
            this.currentStates = this.runStep(this.currentStates, input[i]);
			this.updateActiveStates();
            if (this.currentStates.size === 0)
                return false;
        }
        var acceptingCount = 0;
        var thisAutomata = this;
        this.currentStates.forEach(function(stateIndex) {
            if (thisAutomata.nodes[stateIndex].isAccepting)
                acceptingCount++;
        });
        return acceptingCount > 0;
    }

    runStep(currentStates, alphabet) {
        var ns = [];
        var thisAutomata = this;
        var nextStates = new Set();
        currentStates.forEach(function(currentState) {
            var transitionList = thisAutomata.transitions[currentState];
            if (typeof transitionList !== 'undefined') {
                var next = transitionList[alphabet];
                if (typeof next !== 'undefined')
                    ns = new Set([...ns, ...next]);
            }
        });
        return nextStates = new Set([...nextStates, ...ns]); // union
    }

    draw() {
        this.context.strokeStyle = '#000000';
        var thisAutomata = this;
        for (var source in this.transitions) {
            var alphabetsByTarget = {};
            for (var alphabet in this.transitions[source]) {
                this.transitions[source][alphabet].forEach(function(target) {
                    if (typeof alphabetsByTarget[target] === 'undefined')
                        alphabetsByTarget[target] = []
                    alphabetsByTarget[target].push(alphabet);
                });
            }

            for (var target in alphabetsByTarget) {
                var node = thisAutomata.nodes;

                // draw transition line
                var arcInfo = drawArc(thisAutomata.context,
                    node[source].x, node[source].y,
                    node[target].x, node[target].y);

                // draw transition alphabet
				var aDiff = angleDiff(arcInfo.sAngle, arcInfo.eAngle);
				aDiff = aDiff === 0 ? 2 * Math.PI : aDiff;
                var midAngle = arcInfo.sAngle + aDiff / 2;
                var cx = arcInfo.xc + (arcInfo.r + alphabetOffset) * Math.cos(midAngle);
                var cy = arcInfo.yc + (arcInfo.r + alphabetOffset) * Math.sin(midAngle);
                thisAutomata.context.font = '16px Arial';
                thisAutomata.context.textAlign = 'center';
                thisAutomata.context.fillStyle = '#000000';
                var alphabetList = alphabetsByTarget[target].join(", ")
                thisAutomata.context.fillText(alphabetList, cx, cy);

                // TODO draw arrow head
				var hAngle = arcInfo.eAngle - stateRadius / arcInfo.r;
				drawTriangleOnArc(thisAutomata.context, arcInfo, hAngle);
            }
        }

		// draw all nodes
		this.nodes.forEach(function(node) {
            node.draw();
        });

		// draw initial arrow
		var sNode = this.nodes[this.startingState];
		var hx = sNode.x - stateRadius;
		this.context.beginPath();
		this.context.moveTo(hx - arrowLength, sNode.y - arrowWidth);
		this.context.lineTo(hx, sNode.y);
		this.context.lineTo(hx - arrowLength, sNode.y + arrowWidth);
		this.context.stroke();
		this.context.beginPath();
		this.context.moveTo(hx - arrowLength * 2, sNode.y);
		this.context.lineTo(hx, sNode.y);
		this.context.stroke();
    }

	updateActiveStates() {
		// FIXME bug if state deleted
		for (var j = 0; j < this.nodes.length; j++) {
			this.nodes[j].isActive = false;
		}
		var thisAutomata = this;
		this.currentStates.forEach(function(nodeIndex) {
			thisAutomata.nodes[nodeIndex].isActive = true;
		});
	}
}

class Button {
    constructor(onClickAction, context, label, isVisible = true, x = 0, y = 0) {
        this.label = label;
        this.onClickAction = onClickAction;
        this.isVisible = isVisible;
        this.x = x;
        this.y = y;
        this.r = 30;
        this.context = context;
    }

    onClick(x, y) {
        if (this.isVisible)
            this.onClickAction(x, y);
    }

    draw() {
        if (!this.isVisible)
            return;
        drawCircle(this.context, this.x, this.y, this.r, 2, true, '#00ff00', '#00ff00');
        this.context.font = '16px Arial';
        this.context.textAlign = 'center';
        this.context.fillStyle = '#000000';
        this.context.fillText(this.label, this.x, this.y);
    }

    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    contains(x, y) {
        var dx = x - this.x;
        var dy = y - this.y
        return dx * dx + dy * dy < this.r * this.r;
    }
}

// main
$(function() {
    var uiState = 'idle';
	var context = canvas.getContext("2d");
	var currentStep = -1;
    var buttons = {};
    buttons['newNode'] = new Button(function(x, y) {
        automata.createNode(x, y);
        this.isVisible = false;
    }, context, 'New +', false);

    var automata = new Automata(context);

    reset();
    setInterval(function() {
        update();
        redraw();
    }, 40);

    var isDragging = false;
    var hasMoved = false;
    var selectedIndex = -1;
	var selectedTransition = false;

    var stateOptions = $('#state-options');
    var transitionOptions = $('#transition-options');
    var newTransitionSrcNode = 0;
    var newTransitionDest;

    $('#canvas').mousedown(function(e) {
        hasMoved = false;
        isDragging = true;
        selectedIndex = getNodeIndexAt(e.pageX, e.pageY);
		selectedTransition = getTransitionAt(e.pageX, e.pageY);
        if (!stateOptions.hasClass('hidden')) {
            stateOptions.addClass('hidden');
        }
		if (!transitionOptions.hasClass('hidden')) {
            transitionOptions.addClass('hidden');
        }
    }).mousemove(function(e) {
        hasMoved = true;
        if (isDragging && selectedIndex >= 0) {
            automata.nodes[selectedIndex].setPosition(e.pageX, e.pageY);
        }
        if (uiState === 'makingTransition') {
            newTransitionDest = [e.pageX, e.pageY];
        }
    }).mouseup(function(e) {
        isDragging = false;
        if (!hasMoved) { // this is a click
            if (selectedIndex >= 0) {
                // uiState = 'selected';
                console.log(uiState);
                if (uiState === 'idle') {
                    stateOptions.css('left', e.pageX);
                    stateOptions.css('top', e.pageY);
                    stateOptions.removeClass('hidden');
                } else if (uiState === 'makingTransition') {
                    var alphabet = prompt('Transitioning from ' +
                        automata.nodes[newTransitionSrcNode].name + ' to ' +
                        automata.nodes[selectedIndex].name + ' via alphabet:');
                    if (alphabet.length == 1) {
                        automata.addTransition(newTransitionSrcNode, alphabet, selectedIndex);
                    }
                    uiState = 'idle';
                }
            } else if(selectedTransition !== false) {
				if (uiState === 'idle') {
                    transitionOptions.css('left', e.pageX);
                    transitionOptions.css('top', e.pageY);
                    transitionOptions.removeClass('hidden');
                }
			} else {

                if (uiState === 'makingTransition') {
                    uiState = 'idle';
                }
                if (!buttons['newNode'].isVisible) {
                    // show "ADD" button
                    buttons['newNode'].setPosition(e.pageX, e.pageY);
                    buttons['newNode'].isVisible = true;
                    return;
                }
                doOnClickActions(e.pageX, e.pageY);
                buttons['newNode'].isVisible = false;
            }
        }
    });

    $('.btn-option').click(function() {
        stateOptions.addClass('hidden');
		transitionOptions.addClass('hidden');
    });

    $('#state-option-toggle-accept').click(function() {
        automata.nodes[selectedIndex].isAccepting = !automata.nodes[selectedIndex].isAccepting;
    });

    $('#state-option-rename').click(function() {
        var oldName = automata.nodes[selectedIndex].name;
        var newName = prompt('Rename state from \'' + oldName + '\' to:', oldName);
        if (newName)
            automata.nodes[selectedIndex].name = newName;
    });

    $('#state-option-make-transition').click(function() {
        newTransitionSrcNode = selectedIndex;
        uiState = 'makingTransition';
    });

    $('#state-option-delete').click(function() {
        if (selectedIndex === 0) {
            alert('Cannot delete initial state!');
            return;
        }
		automata.removeNode(selectedIndex);
        uiState = 'idle';
    });

	$('#transition-option-delete').click(function() {
        if (selectedTransition !== false) {
			automata.removeTransitions(selectedTransition[0], selectedTransition[1]);
        }
        uiState = 'idle';
    });

	$('#test-cases').keydown(function() {
		reset();
	});

	$('#run-step').click(function() {
		currentStep++;
		var inputFull = $('#test-cases').val().trim();
		var input = inputFull.substring(0, currentStep);
        console.log('testing', inputFull, 'step', currentStep);
		var isAccepted = automata.run(input);
		setInput(inputFull, currentStep);
		showAccepted(isAccepted);
		if(currentStep >= inputFull.length) {
			emphasize(isAccepted ? '#accepted' : '#rejected');
		}
	});

	$('#reset').click(function() {
		reset();
	});

    $('#test-form').submit(function(e) {
        e.preventDefault();
		var input = $('#test-cases').val().trim();
        console.log('testing', input);
		setInput(input);
        showAccepted(automata.run(input));
		emphasize(isAccepted ? '#accepted' : '#rejected');
    });

    function reset() {
		$('#accepted').addClass('hidden');
		$('#rejected').addClass('hidden');
		$('#test-input').removeClass('has-success');
		$('#test-input').removeClass('has-error');
		currentStep = -1;
		automata.reset();
    }

    function update() {

    }

    function redraw() {
		context.clearRect(0, 0, canvas.width, canvas.height);

        if (uiState === 'makingTransition') {
            if (typeof automata.nodes[selectedIndex] !== 'undefined') {
				context.strokeStyle = '#000000';
				context.moveTo(automata.nodes[selectedIndex].x, automata.nodes[selectedIndex].y);
                context.lineTo(newTransitionDest[0], newTransitionDest[1]);
                context.stroke();
            }
            // TODO draw arrow head
        }

		automata.draw();
        for (var button in buttons) {
            buttons[button].draw();
        }
    }

    function doOnClickActions(x, y) {
        var clickedButton = false;
        for (var button in buttons) {
            if (buttons[button].contains(x, y)) {
                clickedButton = button;
            }
        }
        if (clickedButton !== false && buttons[clickedButton].isVisible) {
            buttons[clickedButton].onClick(x, y);
        }
        return clickedButton;
    }

    function getNodeIndexAt(x, y) {
        var clickedIndex = -1;
        var nodes = automata.nodes;
        for (var i = nodes.length - 1; i >= 0; i--) {
            if (typeof nodes[i] !== 'undefined' && nodes[i].contains(x, y)) {
                clickedIndex = i;
            }
        }
        return clickedIndex;
    }

	function getTransitionAt(x, y) {
        var clickedTransition = false;
		var clickAreaOffset = 8;
		var found = false;
		for (source in automata.transitions) {
			for (var alphabet in automata.transitions[source]) {
				automata.transitions[source][alphabet].forEach(function(target) {
					var sNode = automata.nodes[source];
					var tNode = automata.nodes[target];
					var arc = getArcInfo(sNode.x, sNode.y, tNode.x, tNode.y);
					// check if x,y is in the arc
					if (Math.abs(dist(x - arc.xc, y - arc.yc) - arc.r) <= clickAreaOffset) {
						var angle = Math.atan2(y - arc.yc, x - arc.xc);
						if(isInside(angle, arc.sAngle, arc.eAngle)) {
							clickedTransition = [parseInt(source), target];
							found = true;
						}
					}
				});
				if(found)
					break;
			}
			if(found)
				break;
		}
        return clickedTransition;
    }

	function showAccepted (correct) {
        if (correct) {
            $('#test-input').addClass('has-success');
            $('#test-input').removeClass('has-error');
            $('#accepted').removeClass('hidden');
            $('#rejected').addClass('hidden');
        } else {
            $('#test-input').addClass('has-error');
            $('#test-input').removeClass('has-success');
            $('#accepted').addClass('hidden');
            $('#rejected').removeClass('hidden');
        }
	}

	function setInput(input, currentChar = -1) {
		var html = '';
		if (currentChar < 0)
			currentChar = input.length;
		if (input.length > 0) {
			html += '<b>' + input.substring(0, currentChar) + '</b>';
			html += input.substring(currentChar);
		} else {
			html += 'null';
		}
		$('.input').html(html);
	}
	function emphasize(selector) {
		$(selector).css('transform', 'scale(1.0)');
		setTimeout(function() {
			$(selector).css('transform', 'scale(1.2)');
			setTimeout(function() {
				$(selector).css('transform', 'scale(1.0)');
			}, 100);
		}, 100);
	}
});
