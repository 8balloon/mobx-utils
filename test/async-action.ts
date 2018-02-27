import * as utils from "../"
import * as mobx from "mobx"
import * as test from "tape"

function delay<T>(time: number, value: T, shouldThrow = false): Promise<T> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (shouldThrow) reject(value)
            else resolve(value)
        }, time)
    })
}

test("it should support async generator actions", t => {
    mobx.useStrict(true)
    const values: any[] = []
    const x = mobx.observable({ a: 1 })
    mobx.reaction(() => x.a, v => values.push(v), { fireImmediately: true })

    const f = utils.asyncAction(function*(initial: number) {
        x.a = initial // this runs in action
        x.a = yield delay(100, 3) // and this as well!
        yield delay(100, 0)
        x.a = 4
        return x.a
    })

    setTimeout(() => {
        f(2).then((v: number) => {
            // note: ideally, type of v should be inferred..
            t.is(v, 4)
            t.deepEqual(values, [1, 2, 3, 4])
            t.end()
        })
    }, 10)
})

test("it should support try catch in async generator", t => {
    mobx.useStrict(true)
    const values: any[] = []
    const x = mobx.observable({ a: 1 })
    mobx.reaction(() => x.a, v => values.push(v), { fireImmediately: true })

    const f = utils.asyncAction(function*(initial: number) {
        x.a = initial // this runs in action
        try {
            x.a = yield delay(100, 5, true) // and this as well!
            yield delay(100, 0)
            x.a = 4
        } catch (e) {
            x.a = e
        }
        return x.a
    })

    setTimeout(() => {
        f(2).then((v: number) => {
            // note: ideally, type of v should be inferred..
            t.is(v, 5)
            t.deepEqual(values, [1, 2, 5])
            t.end()
        })
    }, 10)
})

test("it should support throw from async generator", t => {
    utils.asyncAction(function*() {
        throw 7
    })().then(
        () => {
            t.fail()
            t.end()
        },
        e => {
            t.is(e, 7)
            t.end()
        }
    )
})

test("it should support throw from yielded promise generator", t => {
    utils.asyncAction(function*() {
        return yield delay(10, 7, true)
    })().then(
        () => {
            t.fail()
            t.end()
        },
        e => {
            t.is(e, 7)
            t.end()
        }
    )
})

test("it should support asyncAction as decorator", t => {
    const values: any[] = []

    mobx.useStrict(true)

    class X {
        @mobx.observable a = 1;

        @utils.asyncAction
        *f(initial: number) {
            this.a = initial // this runs in action
            try {
                this.a = yield delay(100, 5, true) // and this as well!
                yield delay(100, 0)
                this.a = 4
            } catch (e) {
                this.a = e
            }
            return this.a
        }
    }

    const x = new X()
    mobx.reaction(() => x.a, v => values.push(v), { fireImmediately: true })

    setTimeout(() => {
        // TODO: mweh on any cast...
        ;(x.f(/*test binding*/ 2) as any).then((v: number) => {
            // note: ideally, type of v should be inferred..
            t.is(v, 5)
            t.deepEqual(values, [1, 2, 5])
            t.is(x.a, 5) // correct instance modified?
            t.end()
        })
    }, 10)
})

test("it should support logging", t => {
    mobx.useStrict(true)
    const events: any[] = []
    const x = mobx.observable({ a: 1 })

    const f = utils.asyncAction("myaction", function*(initial: number) {
        x.a = initial
        x.a = yield delay(100, 5)
        x.a = 4
        x.a = yield delay(100, 3)
        return x.a
    })
    const d = mobx.spy(ev => events.push(ev))

    setTimeout(() => {
        f(2).then(() => {
            t.deepEqual(stripEvents(events), [
                {
                    type: "action",
                    name: "myaction - runid: 6 - init",
                    arguments: [2],
                    spyReportStart: true
                },
                { spyReportEnd: true },
                {
                    type: "action",
                    name: "myaction - runid: 6 - yield 0",
                    arguments: [undefined],
                    spyReportStart: true
                },
                {
                    type: "update",
                    oldValue: 1,
                    name: "ObservableObject@74",
                    newValue: 2,
                    key: "a",
                    spyReportStart: true
                },
                { spyReportEnd: true },
                { spyReportEnd: true },
                {
                    type: "action",
                    name: "myaction - runid: 6 - yield 1",
                    arguments: [5],
                    spyReportStart: true
                },
                {
                    type: "update",
                    oldValue: 2,
                    name: "ObservableObject@74",
                    newValue: 5,
                    key: "a",
                    spyReportStart: true
                },
                { spyReportEnd: true },
                {
                    type: "update",
                    oldValue: 5,
                    name: "ObservableObject@74",
                    newValue: 4,
                    key: "a",
                    spyReportStart: true
                },
                { spyReportEnd: true },
                { spyReportEnd: true },
                {
                    type: "action",
                    name: "myaction - runid: 6 - yield 2",
                    arguments: [3],
                    spyReportStart: true
                },
                {
                    type: "update",
                    oldValue: 4,
                    name: "ObservableObject@74",
                    newValue: 3,
                    key: "a",
                    spyReportStart: true
                },
                { spyReportEnd: true },
                { spyReportEnd: true }
            ])
            d()
            t.end()
        })
    }, 10)
})

function stripEvents(events) {
    return events.map(e => {
        delete e.object
        delete e.fn
        delete e.time
        return e
    })
}
