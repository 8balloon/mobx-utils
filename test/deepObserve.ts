import { deepObserve } from "../src/mobx-utils"
import { observable, $mobx, toJS } from "mobx"
import * as cloneDeepWith from "lodash.clonedeepwith"

function cleanChange(change, includeObject = true) {
    return cloneDeepWith(change, (value, key) => {
        if (key === $mobx) return null
        if (key === "object" && !includeObject) return null
    })
}

function assertChanges<T>(x: T, fn: (x: T) => void) {
    const target = observable(x)
    const events: any[] = []

    const d = deepObserve(target, (change, path) => {
        events.push([path, cleanChange(change, false)])
    })

    fn(target)

    expect(events).toMatchSnapshot()
}

test("basic & dispose", () => {
    const x = observable({ a: 1, b: { z: 3 } })
    const events: any[] = []

    const d = deepObserve(x, (change, path) => {
        events.push([path, cleanChange(change)])
    })

    x.a = 2
    x.b.z = 4
    d()
    x.a = 3
    x.b.z = 5
    expect(events).toMatchSnapshot()
})

test("deep", () => {
    assertChanges(
        {
            a: {
                b: {
                    c: 3
                }
            }
        },
        x => {
            x.a.b.c = 4
        }
    )
})

test("add", () => {
    assertChanges({}, x => {
        x.a = 3
    })
})

test("delete", () => {
    assertChanges({ x: 1 }, x => {
        delete x.x
    })
})


test("cleanup", () => {
    const a = observable({ b: 1 })
    const x = observable({ a })
    const events: any[] = []

    const d = deepObserve(x, (change, path) => {
        events.push([path, cleanChange(change)])
    })

    a.b = 2
    delete x.a
    a.b = 3 // should not be visible
    expect(events).toMatchSnapshot()
})

test("throw on double entry", () => {
    const a = observable({ b: 1 })
    const x = observable({ a })
    const events: any[] = []

    const d = deepObserve(x, (change, path) => {
        events.push([path, cleanChange(change)])
    })

    expect(() => {
        (x as any).b = a
    }).toThrow("trying to assign it to '/b', but it already exists at '/a'")
})

