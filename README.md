# chrome-extension-waiter
A small library for making DOM change detection in Chrome extensions easier

If your Chrome extension needs to manipulate DOM elements on external websites, this library makes it easier to detect asynrchronous changes to that page.  A few examples of how you can use Waiter:

- detect when API calls have completed by waiting for DOM nodes to change or populate
- detect URL changes on single page applications and set up events to handle them

Example useage:

    w.waitFor("#test")
    // .timeoutIn(1000, () => console.log("waiting timed out"))
    .toExist()
    .execute(() => console.log("node exists"))
    .toPopulate()
    .execute(() => console.log("node has been populated with new information"))
    .ifValueMatches(/test/gi)
    .execute((node) => console.log("handle the information"))
    .else((node) => console.log("do something else"))
    .end(() => console.log("Chain complete!"));
