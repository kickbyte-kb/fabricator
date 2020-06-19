[![GitHub release](https://img.shields.io/github/release/fbrctr/fabricator.svg)]()
[![Build Status](https://travis-ci.org/fbrctr/fabricator.svg)](https://travis-ci.org/fbrctr/fabricator)
[![devDependency Status](https://david-dm.org/fbrctr/fabricator/dev-status.svg)](https://david-dm.org/fbrctr/fabricator#info=devDependencies)
[![Join the chat at https://gitter.im/fbrctr/fabricator](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/fbrctr/fabricator?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

<p align="center">
  <img src="http://fbrctr.github.io/assets/toolkit/images/logo.svg" width="500">
</p>

# Fabricator

> _fabricate_ - to make by assembling parts or sections.

Fabricator is a tool for building website UI toolkits - _think ["Tiny Bootstraps, for Every Client"](http://daverupert.com/2013/04/responsive-deliverables/#tiny-bootstraps-for-every-client)_

## Quick Start

```shell
$ curl -L https://github.com/fbrctr/fabricator/archive/master.tar.gz | tar zx --strip 1
$ npm start
```

## Documentation

#### [Read the docs →](http://fbrctr.github.io/docs)

## Demo

#### [Default Fabricator Instance →](http://fbrctr.github.io/demo)

## Credits

Created by [Luke Askew](http://twitter.com/lukeaskew).

Logo by [Abby Putinski](https://abbyputinski.com/)

## License

[The MIT License (MIT)](http://opensource.org/licenses/mit-license.php)


## gulp tasks

### gulp --dev
  compiles only the dev folders opens style guide index page to help you navigate to your dev pages or you can navigate in the url using the relative path, it prevents the clean of the project so the older style guide pages will still be there for navigating - watches changes made to src directory
### gulp --all
  deletes the dist folder, compiles the dev and style guide pages, creates a server, opens the style guide index page - does not watch changes made to src directories
### gulp make
  use with --name and --type to create a component folder with the scss and js files included in main
### gulp test
  compiles the backstop.json file based on all components (and pages?) in src runs the tests and opens a browser window with the test result index page
#### gulp approve
  moves all the current test images into the reference image folder
### gulp rmFolder
  use with --name and --type to remove component folder and references in scss and js main files
### gulp clean
  removes dist folder


## NPM shortcuts . use npm [shortcut]
    "prestart": "npm install",
    "build": "npm run prestart && gulp",
    "start": "gulp --dev",
    "test": "eslint --fix . && npm run build",
    "lint": "eslint .",
    "lintfix": "eslint --fix ."

 

