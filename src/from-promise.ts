import {IObservableValue, observable, action} from "mobx";
import {IDENTITY, IThenable} from "./utils";

export type PromiseState = "pending" | "fulfilled" | "rejected";

export interface IPromiseBasedObservable<T> {
    value: T;
    state: PromiseState;
    reason: any;
    promise: IThenable<T>;
}

class PromiseBasedObservable<T> implements IPromiseBasedObservable<T> {
    private _observable: IObservableValue<T>;
    private _state: IObservableValue<PromiseState> = observable("pending" as PromiseState);
    private _reason: IObservableValue<any> = observable(undefined as any);

    constructor(public promise: IThenable<T>, initialValue: T = undefined, private modifier = IDENTITY) {
        this._observable = observable(modifier(initialValue));
        promise.then(action("observableFromPromise-resolve", (value: T) => {
            this._observable.set(this.modifier(value));
            this._state.set("fulfilled");
        })).catch(action("observableFromPromise-reject", (reason: any) => {
            this._reason.set(reason);
            this._state.set("rejected");
        }));
    }

    get value(): T {
        return this._observable.get();
    }
    get state(): PromiseState {
        return this._state.get();
    }
    get reason(): any {
        return this._reason.get();
    }
}

/**
 * `fromPromise` takes a Promise and returns an object with 3 observable properties that track
 * the status of the promise. The returned object has the following observable properties:
 *  - `value`: either the initial value, or the value the Promise resolved to
 *  - `state`: one of `"pending"`, `"fulfilled"` or `"rejected"`
 *  - `reason`: the reject reason if the state is `"rejected"`
 *  - `promise`: (not observable) the original promise object
 *
 * @example
 * const fetchResult = fromPromise(fetch("http://someurl"))
 *
 * // combine with when..
 * when(
 *   () => fetchResult.state !== "pending"
 *   () => {
 *     console.log("Got ", fetchResult.reason || fetchResult.value)
 *   }
 * )
 *
 * // or a mobx-react component..
 * const myComponent = observer(({ fetchResult }) => {
 *   switch(fetchResult.state) {
 *      case "pending": return <div>Loading...</div>
 *      case "rejected": return <div>Ooops... {fetchResult.reason}</div>
 *      case "fulfilled": return <div>Gotcha: {fetchResult.value}</div>
 *   }
 * })
 *
 * @param {IThenable<T>} promise The promise which will be observed
 * @param {T} [initialValue=undefined] Optional predefined initial value
 * @param {any} [modifier=IDENTITY] MobX modifier, e.g. `asFlat`, to be applied to the resolved value
 * @returns {IPromiseBasedObservable<T>}
 */
export function fromPromise<T>(promise: IThenable<T>, initialValue: T = undefined, modifier =  IDENTITY): IPromiseBasedObservable<T> {
    return new PromiseBasedObservable(promise, initialValue, modifier);
}

