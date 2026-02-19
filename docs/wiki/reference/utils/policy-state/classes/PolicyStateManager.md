[**berry-shield**](../../../README.md)

***

# Class: PolicyStateManager

Defined in: [utils/policy-state.ts:43](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/policy-state.ts#L43)

Tracks session policy state and computes injection decisions.

## Constructors

### Constructor

> **new PolicyStateManager**(`retention`, `now?`): `PolicyStateManager`

Defined in: [utils/policy-state.ts:50](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/policy-state.ts#L50)

#### Parameters

##### retention

`BerryShieldPolicyRetentionConfig`

##### now?

`NowFn` = `Date.now`

#### Returns

`PolicyStateManager`

## Methods

### consumeTurnDecision()

> **consumeTurnDecision**(`input`): [`PolicyInjectionDecision`](../type-aliases/PolicyInjectionDecision.md)

Defined in: [utils/policy-state.ts:64](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/policy-state.ts#L64)

#### Parameters

##### input

[`PolicyDecisionInput`](../interfaces/PolicyDecisionInput.md)

#### Returns

[`PolicyInjectionDecision`](../type-aliases/PolicyInjectionDecision.md)

***

### delete()

> **delete**(`sessionKey`): `void`

Defined in: [utils/policy-state.ts:127](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/policy-state.ts#L127)

#### Parameters

##### sessionKey

`string`

#### Returns

`void`

***

### markDenied()

> **markDenied**(`sessionKey`, `escalationTurns?`, `allowGlobalEscalation?`): `void`

Defined in: [utils/policy-state.ts:56](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/policy-state.ts#L56)

#### Parameters

##### sessionKey

`string` | `undefined`

##### escalationTurns?

`number` = `1`

##### allowGlobalEscalation?

`boolean` = `false`

#### Returns

`void`

***

### markInjected()

> **markInjected**(`sessionKey`): `void`

Defined in: [utils/policy-state.ts:121](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/policy-state.ts#L121)

#### Parameters

##### sessionKey

`string`

#### Returns

`void`

***

### markModelSwap()

> **markModelSwap**(`sessionKey`, `escalationTurns?`): `void`

Defined in: [utils/policy-state.ts:60](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/policy-state.ts#L60)

#### Parameters

##### sessionKey

`string`

##### escalationTurns?

`number` = `1`

#### Returns

`void`

***

### prune()

> **prune**(): [`PolicyStateStats`](../interfaces/PolicyStateStats.md)

Defined in: [utils/policy-state.ts:135](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/policy-state.ts#L135)

#### Returns

[`PolicyStateStats`](../interfaces/PolicyStateStats.md)

***

### size()

> **size**(): `number`

Defined in: [utils/policy-state.ts:131](https://github.com/F4bioo/berry-shield/blob/a7e0e0f0bf5b9f8fb9802d29a41df66aa8e0f472/src/utils/policy-state.ts#L131)

#### Returns

`number`
