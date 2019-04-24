## GOALS

- Deep refactoring across whole application
- Switching to the new web technologies. Removing all inrelevant
- Using the component approach. Spliting all legacy code to small clear reusable parts
- Covering the main logic by unit-tests
- Improving of security and performance
- Improving of tech and project documentations
- To prepare the application for mirgation to modern frameworks (React / Angular)

## PLANS

**PHASE 1 (Native web app)**

1. ~~Upgrade Node version~~ (current: node - **v10.15.3**, npm - **v6.4.1**)
2. Remove yeoman configuration
3. Rewrite grunt tasks to npm scripts
4. Remove grunt
5. Migrate bower components to vendor libs
6. Remove bower support
7. Add babel and eslint
8. Update application code to ES2015+ syntax
9. Rewrite RequireJS modules to ES modules
10. Remove jshint configuration
11. Set webpack
12. Update all dependencies to the latest versions
13. Migrate the vendor libs to npm packages
14. Split the project architecture according to component approach
15. Refactor components (try to remove the backbone artifacts and jquery, then leave only the simple native JS components)

**PHASE 2 (React app)**

TBD

**PHASE 3 (Angular app)**

TBD
