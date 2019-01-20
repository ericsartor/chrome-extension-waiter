/*
	TODO:
		- ifTimeout()
*/

const Waiter = function() {
	const DEBUG = true;
	const INTERVAL_MILLISECONDS = 100;

	this.selector = null;
	this.node = null;
	this.interval = null;
	this.waitCounter = 0;
	this.currentWaitNumber = null;

	this.timeouts = {};


	this.callIndex = 0;
	this.callStack = [];

	this.executeIndexes = [];
	this.elseIndexes = [];

	this.completionCallback = null;

	this.ended = false;

	/*
	 * CONSTRUCTOR LOGIC
	 */	

	 setTimeout(() => {
	 	if (!this.ended) {
	 		throw Error("end() must be called at the end of a Waiter chain.");
	 	}
	 })





	/*
	 * PRIVATE METHODS
	 */

	const log = (str) => {
		if (DEBUG) console.log(str);
	}

	const addToCallStack = (func) => {
		this.callStack.push(func);
	}

	const clearCallStack = () => {
		this.callStack = [];
		this.callIndex = 0;
	}

	const next = () => {
		if (this.callIndex === this.callStack.length) {
			clearCallStack();
			this.completionCallback();
			return;
		} else if (this.callStack.length === 0) {
			return;
		} else {
			const i = this.callIndex;

			// add 2 if there is an else function after this function
			this.callIndex += this.elseIndexes.includes(this.callIndex) ? 2 : 1;
			this.callStack[i]();
		}
	}

	const nextElse = () => {
		const i = this.callIndex + 1;
		this.callIndex += 2;

		this.callStack[i]();
	}

	const registerTimeout = (milliseconds, handler, waitNumber) => {
		if (this.timeouts[waitNumber]) {
			throw new Error(`There is already a timeout set for wait number ${waitNumber}`);
		}

		this.timeouts[waitNumber] = { milliseconds, handler };
	}





	/*
	 * PUBLIC METHODS
	 */

	this.end = (callback) => {
		this.completionCallback = callback;
		this.ended = true;
		next();
	}

	this.wait = (milliseconds) => {
		addToCallStack(() => {
			setTimeout(next, milliseconds);
		});

		return this;
	}

	// starts looking for a node based on a query selector, then runs a verification function on that node
	this.waitFor = (selector) => {
		this.selector = selector;
		this.waitCounter++;

		const waitNumber = this.waitCounter;

		addToCallStack(() => {
			// create a timestamp used for determining if the wait operation has timed out
			const waitStartTimestamp = performance.now();
			this.currentWaitNumber = waitNumber;

			this.interval = setInterval(() => {
				// attempt to find the node based on the supplied query selector
				const node  = document.querySelector(this.selector);

				// if the node is found, stop looking and run the next function in the chain
				if (node !== null) {
					this.node = node;
					clearInterval(this.interval);
					next();
					return;
				}

				// if the waiting timeout gets triggered, run the timeout handler
				if (this.timeouts[waitNumber] && performance.now() - waitStartTimestamp > this.timeouts[waitNumber].milliseconds) {
					clearInterval(this.interval);
					this.timeouts[waitNumber].handler && this.timeouts[waitNumber].handler();
					return;
				}
			}, INTERVAL_MILLISECONDS);
		});

		return this;
	}

	this.timeoutIn = (milliseconds, handler) => {
		if (milliseconds === undefined) {
			throw new Error("No timeout millisecond value was provided to timeoutIn()");
		}

		if (!handler) {
			console.warn("It is recommended that a callback be provided to timeoutIn()");
		}

		registerTimeout(milliseconds, handler, this.waitCounter);

		return this;
	}

	// strictly aesthetic function, as waitFor() already confirms node existence by default
	this.toExist = () => {
		addToCallStack(next);

		return this;
	}

	// trigger the click event handler for the current node
	this.click = () => {
		addToCallStack(() => {
			if (this.node === null) {
				throw Error(`click() was triggered on a null value after waiting for "${this.selector}"`);
			}

			this.node.click();
		});

		return this;
	}

	// waits for the current node's textContent to be truthy
	this.toPopulate = (timeoutMilliseconds) => {
		addToCallStack(() => {
			// create a timestamp used for determining if the wait operation has timed out
			const waitStartTimestamp = performance.now();
			timeoutMilliseconds = timeoutMilliseconds || null;

			this.interval = setInterval(() => {
				if (this.node.textContent) {
					clearInterval(this.interval);
					next();
				}

				// if the waiting timeout gets triggered, run the timeout handler
				if (timeoutMilliseconds !== null &&  performance.now() - waitStartTimestamp > timeoutMilliseconds) {
					clearInterval(this.interval);
					timeoutHandler();
				}
			}, INTERVAL_MILLISECONDS);
		});

		return this;
	}

	// checks for string regex match on node's textContent
	this.ifValueMatches = (regex) => {
		addToCallStack(() => {
			if (!this.node) {
				throw Error(`Node does not exist yet based on selector "${this.selector}".`)
			}

			if (this.node.textContent.match(regex)) {
				next();
			} else {
				nextElse();
			}
		});

		return this;
	}

	// run a callback at any point in the chain
	this.execute = (callback) => {
		addToCallStack(() => {
			callback(this.node);
			next();
		});

		this.executeIndexes.push(this.callStack.length - 1);

		return this;
	}

	// used to execute an alternative callback instead of an execute() callback, if preceeded by an if method that doesn't pass
	this.else = (callback) => {
		if (this.executeIndexes.length === 0) {
			throw Error("Cannot use else() before using execute().")
		} else if (this.executeIndexes[this.executeIndexes.length - 1] !== this.callStack.length - 1) {
			throw Error("else() must be called immediately after execute() if used.");
		}

		addToCallStack(() => {
			callback(this.node);
			next();
		});

		this.elseIndexes.push(this.callStack.length - 2);

		return this;
	}
}