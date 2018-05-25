# Change log

## Versions

### v0.next

### v0.3.0

- Feature: Expose Headers from REST responses to the apollo-link chain via context. [#106](https://github.com/apollographql/apollo-link-rest/issues/106)
- Feature: Expose HTTP-error REST responses as JSON if available! [#94](https://github.com/apollographql/apollo-link-rest/issues/94)
- Feature: Add `@type(name: )` as an alternative, lighter-weight system for tagging Nested objects with __typenames! [#72](https://github.com/apollographql/apollo-link-rest/issues/72)
- Feature: Support "No-Content" responses! [#107](https://github.com/apollographql/apollo-link-rest/pull/107) [#111](https://github.com/apollographql/apollo-link-rest/pull/111)
- Feature: Support serializing the body of REST calls with formats other than JSON [#103](https://github.com/apollographql/apollo-link-rest/pull/103)
- Fix: Bundle-size / Tree Shaking issues [#99](https://github.com/apollographql/apollo-link-rest/issues/99)
- Fix: Dependency tweaks to prevent multiple versions of deps [#105](https://github.com/apollographql/apollo-link-rest/issues/105)
- Fix: GraphQL Nested Aliases - [#113](https://github.com/apollographql/apollo-link-rest/pull/113) [#7](https://github.com/apollographql/apollo-link-rest/issues/7)


### v0.2.4

- Enable JSDoc comments for TypeScript!
- Add in-repo copy of docs so PRs can make changes to docs in sync with implementation changes.
- Fixed a bug with recursive type-patching around arrays.
- Fixed a bug in default URI assignment! [#91](https://github.com/apollographql/apollo-link-rest/pull/91)

### v0.2.3

- Fix: react-native: Android boolean responses being iterated by fieldNameNormalizer throws an error [#89](https://github.com/apollographql/apollo-link-rest/issues/89)

### v0.2.2

- Fix: Queries with Arrays & omitted fields would treat those fields as required (and fail) [#85](https://github.com/apollographql/apollo-link-rest/issues/85)

### v0.2.1

- Fix: Query throws an error when path-parameter is falsy [#82](https://github.com/apollographql/apollo-link-rest/issues/82)
- Fix: Concurrency bug when multiple requests are in flight and both use `@export(as:)` [#81](https://github.com/apollographql/apollo-link-rest/issues/81)
- Fix: fieldNameNormalizer/fieldNameDenormalizer should now be working! [#80](https://github.com/apollographql/apollo-link-rest/issues/80)
- Improvement: Jest should now report code-coverage correctly for Unit Tests on PRs!

### v0.2.0

- Feature: Support Handling Non-success HTTP Status Codes
- Feature: Dynamic Paths & Query building using `pathBuilder`
- Improvement: Sourcemaps should now be more TypeScript aware (via rollup changes) see [#76](https://github.com/apollographql/apollo-link-rest/issues/76) for more up-to-date info.

### v0.1.0

Dropping the alpha tag, but keeping the pre-1.0 nature of this project!

Recent changes:

- Fix/Feature: Ability to have deeply nested responses that have __typename set correctly. See `typePatcher` for more details
- Fix: Real-world mutations need their bodies serialized. Mock-fetch allowed incorrect tests to be written. thanks @fabien0102
- Feature: Bodies for mutations can be custom-built.

### v0.0.1-alpha.1

### v0.0.1-alpha.0

- First publish
