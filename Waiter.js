/*
	TODO:
		- ifTimeout()
*/

const Waiter = {};

Waiter.createChain = () => { return new (function() {
	/*
	 * CONSTANTS
	 */	

	const DEBUG = true;
	const INTERVAL_MILLISECONDS = 100;




	/*
	 * PRIVATE PROPERTIES
	 */	

	// these get reset at each call to waitFor()
	_selector = null; // string query selector used for selecting a node
	_node = null; // stores reference to node once found
	_interval = null; // stores reference to interval being used to search for node

	_waitCounter = 0; // a count of how many waitFor() calls have been made in this Waiter chain
	_currentWaitNumber = null; // once chain is running, keeps track of which wait is happening currently

	_timeouts = {}; // key is a waitNumber, value is an object { milliseconds: number, handler: Function | null }

	_callStack = []; // an array of functions to be executed in the order they were registered in the chain
	_callIndex = 0; // stores the index for which function should be run on the next call to _Next()

	_executeIndexes = []; // callIndexes that were registered via execute()
	_elseIndexes = []; // callIndexes that were registered via else(), referring to the relative execute() index

	_completionCallback = null; // function to be run at the end of the chain

	_ended = false; // flag set in end() ensuring a call to end() was registered, checked via timeout





	/*
	 * CONSTRUCTOR LOGIC
	 */	

	 // ensures a call to end() was registered
	 setTimeout(() => {
	 	if (!_ended) {
	 		throw Error("end() must be called at the end of a Waiter chain.");
	 	}
	 })





	/*
	 * PRIVATE METHODS
	 */

	// used for development debugging and logging
	const _Log = (str) => {
		if (DEBUG) console.log(str);
	}

	// adds a task to the call stack when something is registered in the chain
	const _AddToCallStack = (func) => {
		_callStack.push(func);
	}

	// clears the call stack, generally when the end of the chain is reached
	const _ClearCallStack = () => {
		_callStack = [];
		_callIndex = 0;
	}

	// runs the next task in the call stack, and accounts for skipping methods registered via else() if necessary
	// clears the call stack if if the end is reached
	const _Next = () => {
		if (_callIndex === _callStack.length) {
			// end of call stack reached
			_ClearCallStack();
			_completionCallback && _completionCallback();
			return;
		} else if (_callStack.length === 0) {
			return;
		} else {
			// store current call index so it can be incremented before running the next task in the call stack
			const i = _callIndex;

			// add 2 if there is an else function after this function that needs to be skipped
			_callIndex += _elseIndexes.includes(_callIndex) ? 2 : 1;

			_callStack[i]();
		}
	}

	// an alternative to _Next(), only used in if() functions
	const _NextElse = () => {
		// current index is an execute() task, so we add 1 to get the else() task
		const i = _callIndex + 1;

		// increment the call index past the else task
		_callIndex += 2;

		_callStack[i]();
	}

	// adds an entry to the _timesouts map
	const _RegisterTimeout = (milliseconds, handler, waitNumber) => {
		// ensure timeouts aren't overlapping on the same wait task
		if (_timeouts[waitNumber]) {
			throw new Error(`There is already a timeout set for wait number ${waitNumber}`);
		}

		_timeouts[waitNumber] = { milliseconds, handler };
	}





	/*
	 * PUBLIC METHODS
	 */

	// this needs to be called at the end of every chain, as it starts the execution and registers the completion callback
	this.end = (callback) => {
		_completionCallback = callback;
		_ended = true;
		_Next();
	}

	this.get = (node) => {
		_AddToCallStack(() => {
			_node = node;
			_Next();
		});
	}

	// arbitrary time delay
	this.wait = (milliseconds) => {
		_AddToCallStack(() => {
			setTimeout(_Next, milliseconds);
		});

		return this;
	}

	// starts looking for a node based on a query selector via interval, then proceeds once found (or timed out if a timeout is registered)
	this.waitFor = (selector, indexOrPredicate) => {
		_waitCounter++;

		// closure over this wait task's waitNumber for use with the _timeouts map
		const waitNumber = _waitCounter;

		const secondArgType = typeof indexOrPredicate;

		if (!["function", "number"].includes(secondArgType)) {
			throw new Error("Second argument of waitFor() must be either a number or function.");
		}

		_AddToCallStack(() => {
			_selector = selector;

			// create a timestamp used for determining if the wait operation has timed out
			const waitStartTimestamp = performance.now();

			_interval = setInterval(() => {
				// attempt to find the node based on the supplied query selector
				const node = (() => {
					if (indexOrPredicate) {
						if (secondArgType === "function") {
							// return the first node from the list that passes the predicate, or return null if none do
							return Array.from(document.querySelectorAll(_selector)).find((node) => indexOrPredicate(node)) || null;
						} else if (secondArgType === "number") {
							return document.querySelectorAll(_selector).length ? document.querySelectorAll(_selector)[indexOrPredicate] : null;
						}
					} else {
						return document.querySelector(_selector);
					}
				})()

				// if the node is found, stop looking and run the _Next function in the chain
				if (node !== null) {
					_node = node;
					clearInterval(_interval);
					_Next();
					return;
				}

				// if the waiting times out, run the timeout handler
				if (_timeouts[waitNumber] && performance.now() - waitStartTimestamp > _timeouts[waitNumber].milliseconds) {
					clearInterval(_interval);
					_timeouts[waitNumber].handler && _timeouts[waitNumber].handler();
					return;
				}
			}, INTERVAL_MILLISECONDS);
		});

		return this;
	}

	// starts looking for a collection of nodes based on a query selector via interval, then proceeds once found (or timed out if a timeout is registered)
	this.waitForAll = (selector) => {
		_waitCounter++;

		// closure over this wait task's waitNumber for use with the _timeouts map
		const waitNumber = _waitCounter;

		const secondArgType = typeof indexOrPredicate;

		if (!["function", "number"].includes(secondArgType)) {
			throw new Error("Second argument of waitFor() must be either a number or function.");
		}

		_AddToCallStack(() => {
			_selector = selector;

			// create a timestamp used for determining if the wait operation has timed out
			const waitStartTimestamp = performance.now();

			_interval = setInterval(() => {
				// attempt to find the nodes based on the supplied query selector
				const node = document.querySelectorAll(_selector).length ? [...document.querySelectorAll(_selector)] : null;

				// if the nodes are found, stop looking and run the _Next function in the chain
				if (node !== null) {
					_node = node;
					clearInterval(_interval);
					_Next();
					return;
				}

				// if the waiting times out, run the timeout handler
				if (_timeouts[waitNumber] && performance.now() - waitStartTimestamp > _timeouts[waitNumber].milliseconds) {
					clearInterval(_interval);
					_timeouts[waitNumber].handler && _timeouts[waitNumber].handler();
					return;
				}
			}, INTERVAL_MILLISECONDS);
		});

		return this;
	}

	this.waitUntil = (callback) => {
		_waitCounter++;

		// closure over this wait task's waitNumber for use with the _timeouts map
		const waitNumber = _waitCounter;

		_AddToCallStack(() => {
			// create a timestamp used for determining if the wait operation has timed out
			const waitStartTimestamp = performance.now();

			_interval = setInterval(() => {
				// if the callback returns true, stop looking and run the _Next function in the chain
				if (callback()) {
					clearInterval(_interval);
					_Next();
					return;
				}

				// if the waiting times out, run the timeout handler
				if (_timeouts[waitNumber] && performance.now() - waitStartTimestamp > _timeouts[waitNumber].milliseconds) {
					clearInterval(_interval);
					_timeouts[waitNumber].handler && _timeouts[waitNumber].handler();
					return;
				}
			}, INTERVAL_MILLISECONDS);
		});

		return this;
	}

	// registers a timeout with optional handler for the current wait task
	this.timeoutIn = (milliseconds, handler) => {
		if (milliseconds === undefined) {
			throw new Error("No timeout millisecond value was provided to timeoutIn()");
		}

		// handlers are not required
		if (!handler) {
			console.warn("It is recommended that a callback be provided to timeoutIn()");
		}

		_RegisterTimeout(milliseconds, handler, _waitCounter);

		return this;
	}

	// strictly aesthetic function, as waitFor() already confirms node existence by default
	this.toExist = () => {
		_AddToCallStack(_Next);

		return this;
	}

	// trigger the click event handler for the current node
	this.click = () => {
		_AddToCallStack(() => {
			if (_node === null) {
				throw Error(`click() was triggered on a null value after waiting for "${_selector}"`);
			}

			_node.click();

			_Next();
		});

		return this;
	}

	// waits for the current node's textContent to be truthy
	this.toPopulate = () => {
		_waitCounter++;

		// closure over this wait task's waitNumber for use with the _timeouts map
		const waitNumber = _waitCounter;

		_AddToCallStack(() => {
			// create a timestamp used for determining if the wait operation has timed out
			const waitStartTimestamp = performance.now();

			_interval = setInterval(() => {
				if (_node.textContent) {
					clearInterval(_interval);
					_Next();
				}

				// if the waiting times out, run the timeout handler
				if (_timeouts[waitNumber] && performance.now() - waitStartTimestamp > _timeouts[waitNumber].milliseconds) {
					clearInterval(_interval);
					_timeouts[waitNumber].handler && _timeouts[waitNumber].handler();
					return;
				}
			}, INTERVAL_MILLISECONDS);
		});

		return this;
	}

	// checks for string regex match on node's textContent, calls _NextElse() if match fails
	this.ifValueMatches = (regex) => {
		_AddToCallStack(() => {
			if (!_node) {
				throw Error(`Node does not exist yet based on selector "${_selector}".`)
			}

			if (_node.textContent.match(regex)) {
				_Next();
			} else {
				_NextElse();
			}
		});

		return this;
	}

	// run a callback at any point in the chain, which is supplied with the current node as an argument
	this.execute = (callback) => {
		_AddToCallStack(() => {
			callback(_node);
			_Next();
		});

		_executeIndexes.push(_callStack.length - 1);

		return this;
	}

	// used to execute an alternative callback instead of an execute() callback, if preceeded by an if method that doesn't pass
	this.else = (callback) => {
		if (_executeIndexes.length === 0) {
			throw Error("Cannot use else() before using execute().")
		} else if (_executeIndexes[_executeIndexes.length - 1] !== _callStack.length - 1) {
			// checks that the last execute() task is also the most recent task in the call stack
			throw Error("else() must be called immediately after execute() if used.");
		}

		_AddToCallStack(() => {
			callback(_node);
			_Next();
		});

		//  the else() index is stored as its relative execute() task's index
		_elseIndexes.push(_callStack.length - 2);

		return this;
	}
})};