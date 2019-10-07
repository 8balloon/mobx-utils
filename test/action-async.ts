import * as mobx from "mobx"
import { actionAsync, task } from "../src/mobx-utils"

function delay<T>(time: number, value: T) {
    return new Promise<T>(resolve => {
        setTimeout(() => {
            resolve(value)
        }, time)
    })
}

function delayThrow<T>(time: number, value: T) {
    return new Promise<T>((_, reject) => {
        setTimeout(() => {
            reject(value)
        }, time)
    })
}

function expectNoActionsRunning() {
    const obs = mobx.observable.box(1)
    const d = mobx.reaction(() => obs.get(), () => {})
    expect(() => obs.set(2)).toThrow(
        "changing observed observable values outside actions is not allowed"
    )
    d()
}

test("it should support async actions", async () => {
    mobx.configure({ enforceActions: "observed" })
    const values = []
    const x = mobx.observable({ a: 1 })
    mobx.reaction(() => x.a, v => values.push(v), { fireImmediately: true })

    const f = actionAsync(async function(initial) {
        x.a = initial // this runs in action
        x.a = await task(delay(100, 3))
        await task(delay(100, 0))
        x.a = 4
        return x.a
    })

    const v = await f(2)
    expect(v).toBe(4)
    expect(values).toEqual([1, 2, 3, 4])
    expectNoActionsRunning()
})

test("it should support try catch in async", async () => {
    mobx.configure({ enforceActions: "observed" })
    const values = []
    const x = mobx.observable({ a: 1 })
    mobx.reaction(() => x.a, v => values.push(v), { fireImmediately: true })

    const f = actionAsync(async function(initial) {
        x.a = initial // this runs in action
        try {
            x.a = await task(delayThrow(100, 5))
            await task(delay(100, 0))
            x.a = 4
        } catch (e) {
            x.a = e
        }
        return x.a
    })

    const v = await f(2)
    expect(v).toBe(5)
    expect(values).toEqual([1, 2, 5])
    expectNoActionsRunning()
})

test("it should support throw from async actions", async () => {
    mobx.configure({ enforceActions: "observed" })
    try {
        await actionAsync(async () => {
            await task(delay(10, 7))
            throw 7
        })()
        fail("should fail")
    } catch (e) {
        expect(e).toBe(7)
    }
    expectNoActionsRunning()
})

test("it should support throw from awaited promise", async () => {
    mobx.configure({ enforceActions: "observed" })
    try {
        await actionAsync(async () => {
            return await task(delayThrow(10, 7))
        })()
        fail("should fail")
    } catch (e) {
        expect(e).toBe(7)
    }
    expectNoActionsRunning()
})

test("it should support async action in classes", async () => {
    const values = []

    mobx.configure({ enforceActions: "observed" })

    class X {
        a = 1

        f = actionAsync(async function(initial) {
            this.a = initial // this runs in action
            try {
                this.a = await task(delayThrow(100, 5))
                await task(delay(100, 0))
                this.a = 4
            } catch (e) {
                this.a = e
            }
            return this.a
        })
    }
    mobx.decorate(X, {
        a: mobx.observable
    })

    const x = new X()
    mobx.reaction(() => x.a, v => values.push(v), { fireImmediately: true })

    const v = await x.f(2)
    expect(v).toBe(5)
    expect(values).toEqual([1, 2, 5])
    expect(x.a).toBe(5)
    expectNoActionsRunning()
})

test("it should support async action in classes with a method decorator", async () => {
    const values = []

    mobx.configure({ enforceActions: "observed" })

    class X {
        @mobx.observable a = 1

        @actionAsync
        async f(initial) {
            this.a = initial // this runs in action
            try {
                this.a = await task(delayThrow(100, 5))
                await task(delay(100, 0))
                this.a = 4
            } catch (e) {
                this.a = e
            }
            return this.a
        }
    }

    const x = new X()
    mobx.reaction(() => x.a, v => values.push(v), { fireImmediately: true })

    const v = await x.f(2)
    expect(v).toBe(5)
    expect(values).toEqual([1, 2, 5])
    expect(x.a).toBe(5)
    expectNoActionsRunning()
})

test("it should support async action in classes with a field decorator", async () => {
    const values = []

    mobx.configure({ enforceActions: "observed" })

    class X {
        @mobx.observable a = 1

        @actionAsync
        f = async initial => {
            this.a = initial // this runs in action
            try {
                this.a = await task(delayThrow(100, 5))
                await task(delay(100, 0))
                this.a = 4
            } catch (e) {
                this.a = e
            }
            return this.a
        }
    }

    const x = new X()
    mobx.reaction(() => x.a, v => values.push(v), { fireImmediately: true })

    const v = await x.f(2)
    expect(v).toBe(5)
    expect(values).toEqual([1, 2, 5])
    expect(x.a).toBe(5)
    expectNoActionsRunning()
})

test("it should support logging", async () => {
    mobx.configure({ enforceActions: "observed" })
    const events = []
    const x = mobx.observable({ a: 1 })

    const innerF = actionAsync("innerF", async initial => {
        x.a = initial // this runs in action
        x.a = await task(delay(100, 3))
        x.a = 4
        return x.a
    })

    const f = actionAsync("f", async initial => {
        x.a = initial
        x.a = await task(innerF(2))
        x.a = 5
        x.a = await task(delay(100, 3))
        return x.a
    })
    const d = mobx.spy(ev => events.push(ev))

    await f(1)
    expect(stripEvents(events)).toMatchSnapshot()
    d()
    expectNoActionsRunning()
})

function stripEvents(events) {
    return events.map(e => {
        delete e.object
        delete e.fn
        delete e.time
        return e
    })
}

test("it should support async actions within async actions", async () => {
    mobx.configure({ enforceActions: "observed" })
    const values = []
    const x = mobx.observable({ a: 1 })
    mobx.reaction(() => x.a, v => values.push(v), { fireImmediately: true })

    const innerF = actionAsync(async initial => {
        x.a = initial // this runs in action
        x.a = await task(delay(100, 3))
        await task(delay(100, 0))
        x.a = 4
        return x.a
    })

    const f1 = actionAsync(async initial => {
        x.a = await task(innerF(initial))
        x.a = await task(delay(100, 5))
        await task(delay(100, 0))
        x.a = 6
        return x.a
    })

    const v = await f1(2)
    expect(v).toBe(6)
    expect(values).toEqual([1, 2, 3, 4, 5, 6])
    expectNoActionsRunning()
})

test("it should support async actions within async actions that throw", async () => {
    mobx.configure({ enforceActions: "observed" })
    const values = []
    const x = mobx.observable({ a: 1 })
    mobx.reaction(() => x.a, v => values.push(v), { fireImmediately: true })

    const innerF = actionAsync(async function(initial) {
        x.a = initial // this runs in action
        x.a = await task(delay(100, 3))
        await task(delay(100, 0))
        x.a = 4
        throw "err"
    })

    const f = actionAsync(async function(initial) {
        x.a = await task(innerF(initial))
        x.a = await task(delay(100, 5))
        await task(delay(100, 0))
        x.a = 6
        return x.a
    })

    try {
        await f(2)
        fail("should fail")
    } catch (e) {
        expect(e).toBe("err")
    }
    expectNoActionsRunning()
})

test("typing", async () => {
    const nothingAsync = async () => {
        return [5]
    }

    const f = actionAsync(async (_initial: number) => {
        const _n: number[] = await task(nothingAsync())
        expect(_n).toEqual([5])
        return "string"
    })

    const n: string = await f(5)
})

test("dangling promises created indirectly inside the action should be ok", async () => {
    mobx.configure({ enforceActions: "observed" })
    let danglingP

    const f1 = actionAsync(async () => {
        await task(
            new Promise(resolve => {
                setTimeout(() => {
                    danglingP = delay(100, 1) // indirect dangling promise
                    resolve()
                }, 100)
            })
        )
    })

    await f1()

    expect(danglingP).toBeTruthy()
    await danglingP
    expectNoActionsRunning()
})

test("dangling promises created directly inside the action using task should throw", async () => {
    mobx.configure({ enforceActions: "observed" })
    let danglingP

    const f1 = actionAsync(async () => {
        danglingP = task(delay(100, 1)) // dangling promise
    })

    try {
        await f1()
        fail("should fail")
    } catch (e) {
        expect(e.message).toBe(
            "[mobx-utils] 'actionAsync' context not present or invalid. did you await inside an 'actionAsync' without using 'task(promise)'?"
        )
    }

    expect(danglingP).toBeTruthy()
    await danglingP
    expectNoActionsRunning()
})

test("dangling promises created directly inside the action without using task be ok", async () => {
    mobx.configure({ enforceActions: "observed" })
    let danglingP

    const f1 = actionAsync(async () => {
        danglingP = delay(100, 1) // dangling promise
    })

    await f1()

    expect(danglingP).toBeTruthy()
    await danglingP
    expectNoActionsRunning()
})
