# Change log

## Versions

### v0.next

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
