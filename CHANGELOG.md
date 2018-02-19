# Change log

## Versions

### v0.next

- Feature: Support Handling Non-success HTTP Status Codes

### v0.1.0

Dropping the alpha tag, but keeping the pre-1.0 nature of this project!

Recent changes:

- Fix/Feature: Ability to have deeply nested responses that have __typename set correctly. See `typePatcher` for more details
- Fix: Real-world mutations need their bodies serialized. Mock-fetch allowed incorrect tests to be written. thanks @fabien0102
- Feature: Bodies for mutations can be custom-built.

### v0.0.1-alpha.1

### v0.0.1-alpha.0

- First publish
