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

let server = false;
function reload(done) {
  if (server) server.reload();
  done();
}

// configuration
const config = {
  dev: !!argv.dev,
  guide: !!argv.guide,
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
    toolkit: {
      src: 'src/assets/scss/*',
      dest: 'dist/assets/css',
      watch: 'src/assets/scss/*',
    },
  },
  scripts: {
    fabricator: {
      src: './src/assets/fabricator/scripts/fabricator.js',
      dest: 'dist/assets/fabricator/scripts',
      watch: 'src/assets/fabricator/scripts/**/*',
    },
    toolkit: {
      src: './src/assets/js/main.js',
      dest: 'dist/assets/scripts',
      watch: 'src/assets/js/*',
    },
  },
  images: {
    toolkit: {
      src: ['src/assets/images/**/*', 'src/favicon.ico'],
      dest: 'dist/assets/images',
      watch: 'src/assets/images/**/*',
    },
  },
  templates: {
    watch: ['src/**/**/*.{html,md,json,yml,handlebars,html}', 'src/**/*.{html,md,json,yml,handlebars,html}'],
  },
  dest: 'dist',
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

function stylesToolkit() {
  return gulp
    .src(config.styles.toolkit.src)
    .pipe(gulpif(config.dev, sourcemaps.init()))
    .pipe(
      sass({
        includePaths: './node_modules',
      }).on('error', sass.logError)
    )
    .pipe(prefix(config.styles.browsers))
    .pipe(gulpif(!config.dev, csso()))
    .pipe(gulpif(config.dev, sourcemaps.write()))
    .pipe(gulp.dest(config.styles.toolkit.dest));
}

const styles = gulp.parallel(stylesFabricator, stylesToolkit);

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
    .src(config.images.toolkit.src)
    .pipe(imagemin())
    .pipe(gulp.dest(config.images.toolkit.dest));
}
const images = gulp.series(imgFavicon, imgMinification);

// assembly
function assembler(done) {
  fabAssemble({
    views: ['src/views/**/*', '!src/views/+(layouts)/**'], // pages
    // layouts: ['src/views/layouts/*'],
    // layoutIncludes: ['src/material/views/includes/*'],
    materials: ['src/materials/**/*.html', 'src/materials/**/**/*.handlebars'],
    data: ['src/materials/**/**/*.json', 'src/data/*.yml'],
    docs: ['src/materials/**/**/*.md'],
    logErrors: config.dev,
    dest: config.dest,
    helpers: {
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
      def: function(value, fallback) {
        var out = value || fallback;
        return out;
      },
      json: function json(context) {
        return JSON.stringify(context, null, 1);
      },
      toString: function toString(array) {
        if(Array.isArray(array)) {
          return array.join(", ");
        } else if(array instanceof Object) {
          return Object.values(array);
        } else if(array instanceof String) {
          return array;
        }
      },
      atIndex: function atIndex(array, index) {
        if(Array.isArray(array)) {
          return array[index];
        } else {
          return "Error: object is not an array";
        }
      },
      eachData: function eachData(context, options) {
        var fn = options.fn, inverse = options.inverse, ctx;
        var ret = "";
  
        if(context && context.length > 0) {
          for(var i=0, j=context.length; i<j; i++) {
            ctx = Object.create(context[i]);
            ctx.index = i;
            ret = ret + fn(ctx);
          }
        } else {
          ret = inverse(this);
        }
        return ret;
      },
    },
  }, config.dev);
  done();
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
    [config.scripts.fabricator.watch, config.scripts.toolkit.watch],
    { interval: 500 },
    gulp.series(scripts, reload)
  );
  gulp.watch(
    config.images.toolkit.watch,
    { interval: 500 },
    gulp.series(images, reload)
  );
  gulp.watch(
    [config.styles.fabricator.watch, config.styles.toolkit.watch],
    { interval: 500 },
    gulp.series(styles, reload)
  );
}

// default build task
let tasks = [clean, styles, scripts, images, assembler];
if (config.dev || config.guide) tasks = tasks.concat([serve, watch]);
if (config.dev) tasks.splice(0, 1); // prevent clean
gulp.task('default', gulp.series(tasks));
