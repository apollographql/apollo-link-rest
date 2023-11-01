# Change log

## Versions

### v0.next

### v0.9.0

* Feature: Pass context to typePatcher to make it possible to extract args from the URL for use when patching [#260](https://github.com/apollographql/apollo-link-rest/pull/260) [#261](https://github.com/apollographql/apollo-link-rest/pull/261)
* Feature: Allow per-request field-name normalization for symmetry with de-normalization [#253](https://github.com/apollographql/apollo-link-rest/pull/253)
* Improvement: Use globalThis instead of global [#293](https://github.com/apollographql/apollo-link-rest/pull/293)
* Fix: fieldNameNormalizer mangling ArrayBuffer/Blob types [#247](https://github.com/apollographql/apollo-link-rest/pull/247)
* Drop dependency on `graphql-anywhere`! [#301](https://github.com/apollographql/apollo-link-rest/pull/301)

### v0.8.0

In beta for a unreasonably long time, this release has been stable (in-beta) for 2 years now!! It's about time we officially tag the stable version.

The main breaking change is that you need to be running Apollo Client >= 3.

A list of some specific relevant PRs:

* [#241](https://github.com/apollographql/apollo-link-rest/pull/241)
* [#239](https://github.com/apollographql/apollo-link-rest/pull/239)
* [#228](https://github.com/apollographql/apollo-link-rest/pull/228)
* [#209](https://github.com/apollographql/apollo-link-rest/pull/209)

### v0.7.3

* Fix: Nested `@rest(…)` calls with nested `@export(as:…)` directives should keep their contexts distinct in order to work. [#204](https://github.com/apollographql/apollo-link-rest/pull/204)

### v0.7.2

* Fix: FileList/File aren't available in react-native causing crashes. [#200](https://github.com/apollographql/apollo-link-rest/pull/200)

### v0.7.1

* Fix: Duplicated Content Type Header [#188](https://github.com/apollographql/apollo-link-rest/pull/188)
* Fix: FileList Support [#183](https://github.com/apollographql/apollo-link-rest/pull/183)
* Fix: Default Empty object when creating headers [#178](https://github.com/apollographql/apollo-link-rest/pull/178)
* Body-containing Queries [#173](https://github.com/apollographql/apollo-link-rest/pull/173)

### v0.7.0 - Breaking!

#### Breaking changes around `responseTransformer!`

In this [PR #165](https://github.com/apollographql/apollo-link-rest/pull/165), we realized that the `responseTransformer` feature added last release wasn't broad enough, `responseTransformer`s now receive the raw response stream instead of just the `json()`-promise.

Code which relies on this feature will break, however the fix should be very simple:

    Either the responseTransformer function is made `async` and to `await response.json()`, *or* if this syntax is not available, the existing code needs to be wrapped in `response.json().then(data => {/* existing implementation */})`.

#### Other Changes

* Remove restriction that only allows request bodies to be built for Mutation operations. [#154](https://github.com/apollographql/apollo-link-rest/issues/154) & [#173](https://github.com/apollographql/apollo-link-rest/pull/173)
* Fix code sandbox examples [#177](https://github.com/apollographql/apollo-link-rest/pull/177)
* Bug-fix: default to empty headers instead of undefined for IE [#178](https://github.com/apollographql/apollo-link-rest/pull/178)
* Various docs typo fixes


### v0.6.0

* Feature: responseTransformers allow you to restructure & erase "wrapper" objects from your responses. [#146](https://github.com/apollographql/apollo-link-rest/pull/146)
* Tweaks to config for prettier [#153](https://github.com/apollographql/apollo-link-rest/pull/153) & jest [#158](https://github.com/apollographql/apollo-link-rest/pull/158)
* Tests for No-Content responses [#157](https://github.com/apollographql/apollo-link-rest/pull/157) & [#161](https://github.com/apollographql/apollo-link-rest/pull/161)
* Bundle Size-Limit Increased [#162](https://github.com/apollographql/apollo-link-rest/pull/162)
* Restructure Code for preferring `await` over Promise-chains [#159](https://github.com/apollographql/apollo-link-rest/pull/159)

### v0.5.0

* Breaking Change: 404s now no longer throw an error! It's just null data! [#142](https://github.com/apollographql/apollo-link-rest/pull/142)
* Default Accept header if no header configured for `Accept:` [#143](https://github.com/apollographql/apollo-link-rest/pull/143)
* Improve/enable Support for Nested Queries from different apollo-links [#138](https://github.com/apollographql/apollo-link-rest/pull/138)
* Remove Restriction that Mutation must not contain GET queries & vice versa [#140](https://github.com/apollographql/apollo-link-rest/issues/140)

### v0.4.3, v0.4.4

* Expose an internal helper class (PathBuilder) for experimentation

### v0.4.2

* Fix: Bad regexp causes path-replacements with multiple replacement slots to fail [#135](https://github.com/apollographql/apollo-link-rest/issues/135)

### v0.4.1

* Fix: Correctly slicing nested key-paths [#134](https://github.com/apollographql/apollo-link-rest/issues/134)
* Fix: Improve Types for ServerError [#133](https://github.com/apollographql/apollo-link-rest/pull/133)

### v0.4.0

Breaking changes around `path`-variable replacement and `pathBuilder` (previously undocumented, [#132](https://github.com/apollographql/apollo-link-rest/issues/132)).

* Breaking Change: paths now have a new style for variable replacement. (Old style is marked as deprecated, but will still work until v0.5.0). The migration should be easy in most cases `/path/:foo` => `/path/{args.foo}`
* Breaking Change: `pathBuilder` signature changes to give them access to context & other data [#131](https://github.com/apollographql/apollo-link-rest/issues/131) and support optional Values [#130](https://github.com/apollographql/apollo-link-rest/issues/130)
* Breaking Change: `bodyBuilder` signature changes to give them access to context & other data (for consistency with `pathBuilder`)
* Fix/Feature: Queries that fetch Scalar values or Arrays of scalar values should now work! [#129](https://github.com/apollographql/apollo-link-rest/issues/129)

### v0.3.1

* Fix: Fetch Response bodies can only be "read" once after which they throw "Already Read" -- this prevented us from properly speculatively parsing the error bodies outside of a test environment. [#122](https://github.com/apollographql/apollo-link-rest/issues/122)
* Fix: Some browsers explode when you send null to them! [#121](https://github.com/apollographql/apollo-link-rest/issues/121#issuecomment-396049677)

### v0.3.0

* Feature: Expose Headers from REST responses to the apollo-link chain via context. [#106](https://github.com/apollographql/apollo-link-rest/issues/106)
* Feature: Expose HTTP-error REST responses as JSON if available! [#94](https://github.com/apollographql/apollo-link-rest/issues/94)
* Feature: Add `@type(name: )` as an alternative, lighter-weight system for tagging Nested objects with \_\_typenames! [#72](https://github.com/apollographql/apollo-link-rest/issues/72)
* Feature: Support "No-Content" responses! [#107](https://github.com/apollographql/apollo-link-rest/pull/107) [#111](https://github.com/apollographql/apollo-link-rest/pull/111)
* Feature: Support serializing the body of REST calls with formats other than JSON [#103](https://github.com/apollographql/apollo-link-rest/pull/103)
* Fix: Bundle-size / Tree Shaking issues [#99](https://github.com/apollographql/apollo-link-rest/issues/99)
* Fix: Dependency tweaks to prevent multiple versions of deps [#105](https://github.com/apollographql/apollo-link-rest/issues/105)
* Fix: GraphQL Nested Aliases - [#113](https://github.com/apollographql/apollo-link-rest/pull/113) [#7](https://github.com/apollographql/apollo-link-rest/issues/7)

### v0.2.4

* Enable JSDoc comments for TypeScript!
* Add in-repo copy of docs so PRs can make changes to docs in sync with implementation changes.
* Fixed a bug with recursive type-patching around arrays.
* Fixed a bug in default URI assignment! [#91](https://github.com/apollographql/apollo-link-rest/pull/91)

### v0.2.3

* Fix: react-native: Android boolean responses being iterated by fieldNameNormalizer throws an error [#89](https://github.com/apollographql/apollo-link-rest/issues/89)

### v0.2.2

* Fix: Queries with Arrays & omitted fields would treat those fields as required (and fail) [#85](https://github.com/apollographql/apollo-link-rest/issues/85)

### v0.2.1

* Fix: Query throws an error when path-parameter is falsy [#82](https://github.com/apollographql/apollo-link-rest/issues/82)
* Fix: Concurrency bug when multiple requests are in flight and both use `@export(as:)` [#81](https://github.com/apollographql/apollo-link-rest/issues/81)
* Fix: fieldNameNormalizer/fieldNameDenormalizer should now be working! [#80](https://github.com/apollographql/apollo-link-rest/issues/80)
* Improvement: Jest should now report code-coverage correctly for Unit Tests on PRs!

### v0.2.0

* Feature: Support Handling Non-success HTTP Status Codes
* Feature: Dynamic Paths & Query building using `pathBuilder`
* Improvement: Sourcemaps should now be more TypeScript aware (via rollup changes) see [#76](https://github.com/apollographql/apollo-link-rest/issues/76) for more up-to-date info.

### v0.1.0

Dropping the alpha tag, but keeping the pre-1.0 nature of this project!

Recent changes:

* Fix/Feature: Ability to have deeply nested responses that have \_\_typename set correctly. See `typePatcher` for more details
* Fix: Real-world mutations need their bodies serialized. Mock-fetch allowed incorrect tests to be written. thanks @fabien0102
* Feature: Bodies for mutations can be custom-built.

### v0.0.1-alpha.1

### v0.0.1-alpha.0

* First publish
