const fabAssemble = require('fabricator-assemble');
const browserSync = require('browser-sync');
const csso = require('gulp-csso');
const del = require('del');
const gulp = require('gulp');
const argv = require('minimist')(process.argv.slice(2));
const log = require('fancy-log');
const gulpif = require('gulp-if');
const imagemin = require('gulp-imagemin');
const prefix = require('gulp-autoprefixer');
const rename = require('gulp-rename');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const webpack = require('webpack');
sass.compiler = require('node-sass');

const backstop = require('backstopjs');
const util = require('util');
const rimraf = require('rimraf');
const prepend = require('prepend-file');
const color = require('gulp-color');
const glob = require('glob');
const scsslint = require('gulp-scss-lint');

const {
  writeFileSync,
  readFileSync,
  readFile,
  appendFile,
  mkdir,
  writeFile,
  existsSync,
} = require('fs');
const webserver = require('gulp-webserver');

const asyncMkdir = util.promisify(mkdir);
const asyncReadFile = util.promisify(readFile);
const asyncWriteFile = util.promisify(writeFile);
const asyncAppendFile = util.promisify(appendFile);
const asyncRimraf = util.promisify(rimraf);
const asyncPrepend = util.promisify(prepend);
const asyncBasktop = util.promisify(backstop);
const asyncInit = util.promisify(browserSync.init);

let server = false;
function reload(done) {
  if (server) server.reload();
  done();
}

let xs = 'base';
var sm = 'simple';
var md = 'dynamic';
var lg = 'section';
var xlg = 'page';

let templates = [
    xs,
    sm,
    md,
    lg,
    xlg
];

// configuration
const config = {
  dev: !!argv.dev,
  all: !!argv.all,
  name: argv.name
    ? argv.name.charAt(0).toLowerCase() + argv.name.substring(1)
    : null,
  type: argv.type ? argv.type : null,
  path: () =>
    config.type != xlg
      ? `./src/${config.type}/${config.name}/`
      : `./src/views/${config.type}/${config.name}/`,
  host: 'localhost',
  port: '3000',
  serverUrl: 'http://127.0.0.1:5500',
  styles: {
    browsers: [
      'ie 11',
      'edge >= 16',
      'chrome >= 70',
      'firefox >= 63',
      'safari >= 11',
      'iOS >= 12',
      'ChromeAndroid >= 70',
    ],
    fabricator: {
      src: 'src/assets/fabricator/styles/fabricator.scss',
      dest: 'dist/assets/fabricator/styles',
      watch: 'src/assets/fabricator/styles/**/*',
    },
    project: {
      src: ['src/assets/scss/*'],
      dest: 'dist/assets/css',
      watch: 'src/assets/scss/*',
    },
    vendor: {
      src: 'src/vendor/**/dist/css/*',
      dest: 'dist/assets/vendor/css',
    },
  },
  scripts: {
    fabricator: {
      src: './src/assets/fabricator/scripts/fabricator.js',
      dest: 'dist/assets/fabricator/scripts',
      watch: 'src/assets/fabricator/scripts/**/*',
    },
    project: {
      src: './src/assets/js/main.js',
      dest: 'dist/assets/scripts',
      watch: 'src/assets/js/*',
    },
    vendor: {
      src: 'src/vendor/**/dist/js/*',
      dest: 'dist/assets/vendor/js',
    },
  },
  images: {
    project: {
      src: ['src/assets/images/**/*', 'src/**/**/images/*', 'src/favicon.ico'],
      dest: 'dist/assets/images',
      watch: 'src/assets/images/**/*',
    },
  },
  templates: {
    watch: [
      'src/**/**/*.{html,md,json,yml,handlebars,html}',
      'src/**/*.{html,md,json,yml,handlebars,html}',
    ],
  },
  materials (ext) {
    return [
      `src/base/*.{${ext}}`,
      `src/simple/*.{${ext}}`,
      `src/section/*.{${ext}}`,
      `src/dynamic/*.{${ext}}`,
      `src/base/**/*.{${ext}}`,
      `src/simple/**/*.{${ext}}`,
      `src/section/**/*.{${ext}}`,
      `src/dynamic/**/*.{${ext}}`]
  },
  styles
  dest: 'dist',
};


var stylesGlob = templates.map((t) => `./src/${t}/**/*.scss`);
var stylesGlobLint = [...stylesGlob, "./src/assets/scss/*.scss"];
var stylesGlobCompile =  [...stylesGlobLint, "./vendor/**/**/*.scss"];

let helpers = {
  // {{ default description "string of content used if description var is undefined" }}
  default: function defaultFn(...args) {
    return args.find(value => !!value);
  },
  // {{ concat str1 "string 2" }}
  concat: function concat(...args) {
    return args.slice(0, args.length - 1).join('');
  },
  // {{> (dynamicPartial name) }} ---- name = 'nameOfComponent'
  dynamicPartial: function dynamicPartial(name) {
    return name;
  },
  eq: function eq(v1, v2) {
    return v1 === v2;
  },
  ne: function ne(v1, v2) {
    return v1 !== v2;
  },
  and: function and(v1, v2) {
    return v1 && v2;
  },
  or: function or(v1, v2) {
    return v1 || v2;
  },
  not: function not(v1) {
    return !v1;
  },
  gte: function gte(a, b) {
    return +a >= +b;
  },
  lte: function lte(a, b) {
    return +a <= +b;
  },
  plus: function plus(a, b) {
    return +a + +b;
  },
  minus: function minus(a, b) {
    return +a - +b;
  },
  divide: function divide(a, b) {
    return +a / +b;
  },
  multiply: function multiply(a, b) {
    return +a * +b;
  },
  abs: function abs(a) {
    return Math.abs(a);
  },
  mod: function mod(a, b) {
    return +a % +b;
  },
  def(value, fallback) {
    var out = value || fallback;
    return out;
  },
  json: function json(context) {
    return JSON.stringify(context, null, 1);
  },
  toString: function toString(array) {
    if(Array.isArray(array)) {
      return array.join(", ");
    } if(array instanceof Object) {
      return Object.values(array);
    } else if(array instanceof String) {
      return array;
    }
  },
  atIndex: function atIndex(array, index) {
    if(Array.isArray(array)) {
      return array[index];
    } 
      return "Error: object is not an array";
    
  },
  eachData: function eachData(context, options) {
    let fn = options.fn; var inverse = options.inverse; var ctx;
    let ret = '';

    if (context && context.length > 0) {
      for (var i = 0, j = context.length; i < j; i++) {
        ctx = Object.create(context[i]);
        ctx.index = i;
        ret += fn(ctx);
      }
    } else {
      ret = inverse(this);
    }
    return ret;
  },
};

// clean
const clean = () => del([config.dest]);

// styles
function stylesFabricator() {
  return gulp
    .src(config.styles.fabricator.src)
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(prefix(config.styles.browsers))
    .pipe(gulpif(!config.dev, csso()))
    .pipe(rename('f.css'))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(config.styles.fabricator.dest));
}


/**reference: https://www.npmjs.com/package/gulp-scss-lint */
const lintStyles = () => {
  var errorType = ''; //fail on errors
  var endless = false;
  return gulp.src(stylesGlobLint)
      .pipe(debug({title: "linting: ", showFiles: true, showCount: false}))
      .pipe(scsslint({
          'config': "./lint.yml",
          'reporterOutputFormat': 'Checkstyle',
      }))
      .pipe(scsslint.failReporter(errorType)); //if you just want failReporter to fail just with errors pass the 'E' string
};

function stylesProject() {
  return gulp
    .src(config.styles.project.src)
    .pipe(gulpif(config.dev, sourcemaps.init()))
    .pipe(
      sass({
        includePaths: './node_modules',
      }).on('error', sass.logError)
    )
    .pipe(prefix(config.styles.browsers))
    .pipe(gulpif(!config.dev, csso()))
    .pipe(gulpif(config.dev, sourcemaps.write()))
    .pipe(gulp.dest(config.styles.project.dest));
}

function stylesVendor() {
  return gulp
    .src(config.styles.vendor.src)
    .pipe(
      rename((path) => {
    path.dirname = "";
    return path;
  }))
  .pipe(gulp.dest(config.styles.vendor.dest))
}

function scriptsVendor() {
  return gulp
    .src(config.scripts.vendor.src)
    .pipe(
      rename((path) => {
    path.dirname = "";
    return path;
  }))
  .pipe(gulp.dest(config.scripts.vendor.dest))
}

const styles = gulp.parallel(stylesFabricator, stylesProject, stylesVendor);

// scripts
const webpackConfig = require('./webpack.config')(config);

function scripts(done) {
  webpack(webpackConfig, (err, stats) => {
    if (err) {
      log.error(err());
    }
    const result = stats.toJson();
    if (result.errors.length) {
      result.errors.forEach(error => {
        log.error(error);
      });
    }
    done();
  });
}

// images
function imgFavicon() {
  return gulp.src('src/favicon.ico').pipe(gulp.dest(config.dest));
}

function imgMinification() {
  return gulp
    .src(config.images.project.src)
    .pipe(imagemin())
    .pipe(gulp.dest(config.images.project.dest));
}
const images = gulp.series(imgFavicon, imgMinification);

// assembly
async function assembler() {
  return fabAssemble(
    {
    materials: config.materials("html,handlebars"),
    data: ['src/assets/data/*.yml', ...config.materials("json,yml")],
    docs: config.materials("md"),
      logErrors: config.dev,
    dest: config.dest,
      helpers: helpers,
  }, config.dev);
}

// server
function serve(done) {
  server = browserSync.create();
  server.init({
    server: {
      baseDir: config.dest,
    },
    notify: false,
    logPrefix: 'FABRICATOR',
  });
  done();
}

function watch() {
  gulp.watch(
    config.templates.watch,
    { interval: 500 },
    gulp.series(assembler, reload)
  );
  gulp.watch(
    [config.scripts.fabricator.watch, config.scripts.project.watch],
    { interval: 500 },
    gulp.series(scripts, reload)
  );
  gulp.watch(
    config.images.project.watch,
    { interval: 500 },
    gulp.series(images, reload)
  );
  gulp.watch(
    [config.styles.fabricator.watch, config.styles.project.watch],
    { interval: 500 },
    gulp.series(styles, reload)
  );
}


/** make:
 * command line operation: takes --name= and --type=
 * runs make folder, if fails reverts folders and files made
 * runs compileHtml if fails reverts folders and files made
 * runs tests & approve if fails revers folders and files made
 */
const make = async () => {
  if (!config.name) {
      log(color(`Must define name with --name=$FolderName`, 'RED'));
    return;
  }

  if (!config.type) {
      log(color(`Must define type with --type=[${templates.join(", ")}]`, 'RED'));
      return;
  }
  let name = config.name;
  let type = config.type;
  let path = config.path();

  if (existsSync(path)) {
    log(color('this directory already exists', 'RED'));
      return;
  }

  if (templates.indexOf(type) < 0) {
      log(color(`this type does not exists. Try: \n${templates.join(", \n")}`, 'RED'));
      return;
  }

  try {
      await mkFolder(name, type, path);
      log(color(`Made Folder src/${type}/${name}`, 'YELLOW'));
  } catch (err) {
    console.log('mkFolder Error: ' + err);
    return await removeFolder(name, type);
  }

  try {
    // await compileHtmlSingleFile(name, type, path);
      await assembler();
      log(color(`Compiled ${name}`, 'YELLOW'));
  } catch (e) {
      console.log(`compileHtml Error: ${  e}`);
      return await removeFolder(name, type);
  }

  // backstop
  // try {
  //     await TestSingleFile(name, type);
  //     log(color(`Tested and Approved ${name}`, 'YELLOW'));
  // } catch (e) {
  //     console.log("TestSingleFile Error: " + e);
  //     return await removeFolder(name, type);
  // }

  // if(server) {
  //   server.exit();
  // }

  return Promise.resolve();
};

/** mkFolder:
 * depending on user inputs will create unique component scafolding based on type.
 */
const mkFolder = async (name, type, dirName) => {
  var html = '';
  var images = false;
  let js = null;
  let cssName = config.name.replace(/([A-Z])/g, '-$1').toLowerCase();
  let jsName = name.charAt(0).toUpperCase() + name.slice(1);
  let scss = `.${type}-${cssName} {}
`;
  let schema = {
    title: `${name}`,
    js: 'main.js',
      "css": "main.css",
    bodyClass: '',
      "mainClass": "",
      "documentation": "",
};
  let variations = [
    {
          "partial": `${name}`,
          "data": {
              "text": `${name}`,
        cssVariation: '',
      },
    },
  ];
  let content = [
    {
          "partial": `${name}`,
      data: {
        title: `${name}`,
      },
    },
  ];
  switch (config.type) {
      case xs:
          schema.variations = variations;
          html = `<button class="${type}-${cssName} {{cssVariation}}">
  {{text}}
</button>
`;
      break;
      case sm:
          schema.variations = variations;
          html = `<div class="alert alert-primary ${type}-${cssName}" role="alert">
          A simple primary alert—check it out!
        </div>
`;
      js = `class ${jsName} {}
export default ${jsName};
`;
var images = true;
      break;
      case md:
      schema.variations = variations;
      html = `<nav aria-label="breadcrumb" class="${type}-${cssName}">
  <ol class="breadcrumb">
      <li class="breadcrumb-item"><a href="#">Home</a></li>
      <li class="breadcrumb-item"><a href="#">Library</a></li>
      <li class="breadcrumb-item active" aria-current="page">Data</li>
  </ol>
</nav>
`;
      js = `class ${jsName} {}
export default ${jsName};
`;
var images = true;
      break;
    case lg:
      schema.content = content;
      var html = `<div class="jumbotron ${type}-${cssName}">
      <h1 class="display-4">Hello, world!</h1>
      <p class="lead">This is a simple hero unit, a simple jumbotron-style component for calling extra attention to featured content or information.</p>
      <hr class="my-4">
      <p>It uses utility classes for typography and spacing to space content out within the larger container.</p>
      <a class="btn btn-primary btn-lg" href="#" role="button">Learn more</a>
    </div>
`;
var images = true;
      break;
      case xlg: 
      scss = null;
      var images = true;
      schema.content = content;
      var html = `<section>
  <h1>{{title}}</h1>
  <div>
      <!-- include partials here -->
      <h4>include partials here</h4>
  </div>
</section>
<aside>
  <!-- include partials here -->
  <h4>include partials here</h4>
</aside>
`;

      break;
    default:
      throw 'issue creating files';
  }

  let listOfPromises = [];
  let topFolder = await asyncMkdir(dirName, { recursive: true });
  let htmlFile = await asyncWriteFile(`${dirName}/${name}.handlebars`, html);
  let schemaFile = await asyncWriteFile(
    `${dirName}/${name}.json`,
    JSON.stringify(schema, null, 2)
  );

  if (scss) {
    var cssFile = await asyncWriteFile(`${dirName}/_${name}.scss`, scss);
    var mainScssFile = await asyncAppendFile(
      `src/assets/scss/imports.scss`,
      `@import '../../${type}/${name}/${name}';\n`
    );
    listOfPromises.push(cssFile);
  }

  if (images) {
    var imageDir = await asyncMkdir(`${dirName}/images`, { recursive: true });
    listOfPromises.push(imageDir);
  }

  if (js) {
    var jsFile = await asyncWriteFile(`${dirName}/${name}.js`, js);
    var mainJsFile = await asyncPrepend(
      `src/assets/js/main.js`,
      `import { ${name} } from '../../${type}/${name}/${name}';\n`
    );
    listOfPromises.push(jsFile);
      listOfPromises.push(mainJsFile);
  }

  listOfPromises.push(schemaFile);
  listOfPromises.push(topFolder);
  listOfPromises.push(htmlFile);
  listOfPromises.push(mainScssFile);
  return Promise.all(listOfPromises);
};

/** START: Tests */

/** grabs the basic baskstop template, updates the scenarios with all files in dist/*.html */
/** reference https://www.npmjs.com/package/backstopjs */
const testUpdate = async () => {
  let scenarios = [];
  let configFile = await asyncReadFile('./backstop.json.bak', {
    encoding: 'utf8',
  });
  let backstopConfig = JSON.parse(configFile);
  let allHtml = glob.sync('./dist/**/*.html', { ignore: ['./dist/*.html'] }); // ignore the style guide html pages
  for (let i = 0; i < allHtml.length; i++) {
    let file = allHtml[i];
    var label = file
      .replace('./dist/', '')
      .replace('.html', '')
      .split('/')
      .join('-');
          let url = server ? server.proxy : config.serverUrl;
          let fileJson = 
          {
      label: label,
              url: file.replace("./dist", url) 
    };
          scenarios.push(fileJson);
  }
      backstopConfig.scenarios = scenarios;
  return await asyncWriteFile(
    './backstop.json',
    JSON.stringify(backstopConfig, null, 1)
  );
};

/** reference https://www.npmjs.com/package/backstopjs */
const testTest = async () => {
  await asyncBasktop('test');
  return server.exit();
};

/** reference https://www.npmjs.com/package/backstopjs */
const approve = async () => {
  return await asyncBasktop('approve');
};

const test = gulp.series(testUpdate, testTest);

/** Start Reverts */
//* * user to enter --name and -type to completely remove a component from project */
const rmFolder = async () => {
  if (!config.name) {
      log(color(`Must define name with --name=$FolderName`, 'RED'));
    return;
  }

  if (!config.type) {
      log(color(`Must define type with --type=DesignType`, 'RED'));
      return;
  }
  let name = config.name;
  let type = config.type;
  let path = config.path();

  if (!existsSync(path)) {
      log(color("this directory does not exists", 'RED'));
    return;
  }

  if (templates.indexOf(type) < 0) {
      log(color(`this type does not exists. Try: \n${templates.join(", \n")}`, 'RED'));
      return;
  }

  return await removeFolder(name, type);
};

const removeFolder = async (name, type) => {
  var rmFolder = await asyncRimraf(`./src/${type}/${name}`);
      let rmDist = await asyncRimraf(`./dist/${type}/${name}.html`);
      let rmBackstopRef = await asyncRimraf(`./backstop_data/bitmaps_reference/backstop_default_${type}-${name}-*`);
     let rmBackstopTests = await asyncRimraf(`./backstop_data/bitmaps_test/**/backstop_default_${type}-${name}-*`);
  var scss = await asyncReadFile(`src/assets/scss/imports.scss`, {
    encoding: 'utf8',
  });
  let newScss = scss.replace(`@import '../../${type}/${name}/${name}';\n`, "");

  var rmMainScssLine = await asyncWriteFile(
    `src/assets/scss/imports.scss`,
    newScss
  );
      let mainJs = await asyncReadFile(`src/assets/js/main.js`, { encoding: 'utf8'});
  var mainJsNew = mainJs.replace(
    `import { ${name} } from '../../${type}/${name}/${name}';\n`,
    ''
  );
  let rmMainJsLine = await asyncWriteFile(`src/assets/js/main.js`, mainJsNew);
  return Promise.all([
    rmFolder,
    rmDist,
    rmBackstopRef,
    rmBackstopTests,
    rmMainScssLine,
    rmMainJsLine,
  ]);
};


// default build task
let tasks = [clean, styles, scripts, scriptsVendor, images, assembler];
if (config.dev) tasks = tasks.concat([serve, watch]);
if (config.dev) tasks.splice(0, 1); // prevent clean
gulp.task('make', make);
gulp.task('test', test);
gulp.task('approve', approve);
gulp.task('rmFolder', rmFolder);
gulp.task('serve', serve);
gulp.task('clean', clean);
// TODO ensure linting is happening
// gulp.task('deployStyles', exportStyles);
// gulp.task('deployScripts', exportScripts);
gulp.task('default', gulp.series(tasks));
