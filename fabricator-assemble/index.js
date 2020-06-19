// modules
const _ = require('lodash');
const beautifyHtml = require('js-beautify').html;
const chalk = require('chalk');
const fs = require('fs');
const globby = require('globby');
const Handlebars = require('handlebars');
const inflect = require('i')();
const matter = require('gray-matter');
const md = require('markdown-it')({ html: true, linkify: true });
const mkdirp = require('mkdirp');
const path = require('path');
const sortObj = require('sort-object');
const yaml = require('js-yaml');

/**
 * Default options
 * @type {Object}
 */
const defaults = {
	/**
	 * ID (filename) of default layout
	 * @type {String}
	 */
	layout: 'default',

	/**
	 * ID (filename) of default dev layout
	 * @type {String}
	 */
	devlayout: 'dev',

	/**
	 * Layout templates
	 * @type {(String|Array)}
	 */
	layouts: ['src/views/layouts/*'],

	/**
	 * Layout includes (partials)
	 * @type {String}
	 */
	layoutIncludes: ['src/views/layouts/includes/*'],

	/**
	 * Pages to be inserted into a layout
	 * @type {(String|Array)}
	 */
	views: ['src/views/**/*', '!src/views/+(layouts)/**'],

	/**
	 * Materials - snippets turned into partials
	 * @type {(String|Array)}
	 */
	materials: ['src/materials/**/*'],

	/**
	 * JSON or YAML data models that are piped into views
	 * @type {(String|Array)}
	 */
	data: ['src/data/**/*.{json,yml}'],

	/**
	 * Data to be merged into context
	 * @type {(Object)}
	 */
	buildData: {},

	/**
	 * Markdown files containing toolkit-wide documentation
	 * @type {(String|Array)}
	 */
	docs: ['src/docs/**/*.md'],

	/**
	 * Keywords used to access items in views
	 * @type {Object}
	 */
	keys: {
		materials: 'materials',
		views: 'views',
		docs: 'docs',
	},

	/**
	 * Location to write files
	 * @type {String}
	 */
	dest: 'dist',

	/**
	 * Extension to output files as
	 * @type {String}
	 */
	extension: '.html',

	/**
	 * Custom dest map
	 * @type {Object}
	 */
	destMap: {},

	/**
	 * beautifier options
	 * @type {Object}
	 */
	beautifier: {
		indent_size: 1,
		indent_char: '	',
		indent_with_tabs: true,
	},

	/**
	 * Function to call when an error occurs
	 * @type {Function}
	 */
	onError: null,

	/**
	 * Whether or not to log errors to console
	 * @type {Boolean}
	 */
	logErrors: false,

	/**
	 * Overrides default when a value is given
	 * @type {String}
	 */
	baseUrl: '',

	/**
	 * Sets up global values across your fabircator instance.
	 * Global values can be accessed by their keys.
	 *
	 * For example:
	 *
	 * {{ GLOBAL.SIGN_IN_LINK }}
	 *
	 * Globals in fabricator work in a similar manner to
	 * webpacks DefinePlugin.
	 */
	GLOBAL: {},
};

/**
 * Merged defaults and user options
 * @type {Object}
 */
let options = {};

/**
 * Assembly data storage
 * @type {Object}
 */
const assembly = {
	/**
	 * Contents of each layout file
	 * @type {Object}
	 */
	layouts: {},

	/**
	 * Parsed JSON data from each data file
	 * @type {Object}
	 */
	data: {},

	/**
	 * Meta data for materials, grouped by "collection" (sub-directory); contains name and sub-items
	 * @type {Object}
	 */
	materials: {},

	/**
	 * Each material's front-matter data
	 * @type {Object}
	 */
	materialData: {},

	/**
	 * Meta data for user-created views (views in views/{subdir})
	 * @type {Object}
	 */
	views: {},

	/**
	 * Meta data (name, sub-items) for doc file
	 * @type {Object}
	 */
	docs: {},
};

/**
 * Get the name of a file (minus extension) from a path
 * @param  {String} filePath
 * @example
 * './src/materials/structures/foo.html' -> 'foo'
 * './src/materials/structures/02-bar.html' -> 'bar'
 * @return {String}
 */
const getName = function(filePath, preserveNumbers) {
	// get name; replace spaces with dashes
	const name = path
		.basename(filePath, path.extname(filePath))
		.replace(/\s/g, '-');
	return preserveNumbers ? name : name.replace(/^[0-9|\.\-]+/, '');
};

/**
 * Attempt to read front matter, handle errors
 * @param  {String} file Path to file
 * @return {Object}
 */
const getMatter = function(file) {
	return matter.read(file, {
		parser: require('js-yaml').safeLoad,
	});
};

/**
 * Handle errors
 * @param  {Object} e Error object
 */
const handleError = function(e) {
	// default to exiting process on error
	let exit = true;

	// construct error object by combining argument with defaults
	const error = _.assign(
		{},
		{
			name: 'Error',
			reason: '',
			message: 'An error occurred',
		},
		e
	);

	// call onError
	if (_.isFunction(options.onError)) {
		options.onError(error);
		exit = false;
	}

	// log errors
	if (options.logErrors) {
		console.error(
			chalk.bold.red(`Error (fabricator-assemble): ${e.message}\n`),
			e.stack
		);
		exit = false;
	}

	// break the build if desired
	if (exit) {
		console.error(
			chalk.bold.red(`Error (fabricator-assemble): ${e.message}\n`),
			e.stack
		);
		process.exit(1);
	}
};

/**
 * Build the template context by merging context-specific data with assembly data
 * @param  {Object} data
 * @return {Object}
 */
const buildContext = function(data, hash) {
	// set keys to whatever is defined
	const materials = {};
	materials[options.keys.materials] = assembly.materials;

	const views = {};
	views[options.keys.views] = assembly.views;

	const docs = {};
	docs[options.keys.docs] = assembly.docs;

	let newObj = {};
	if (typeof data === 'string') {
		newObj = { theme: data };
	}

	return _.assign(
		{},
		newObj,
		data,
		assembly.data,
		assembly.materialData,
		options.buildData,
		materials,
		views,
		docs,
		hash
	);
};

/**
 * Convert a file name to title case
 * @param  {String} str
 * @return {String}
 */
const toTitleCase = function(str) {
	return str.replace(/(\-|_)/g, ' ').replace(/\w\S*/g, word => {
		return word.charAt(0).toUpperCase() + word.substr(1).toLowerCase();
	});
};

/**
 * Insert the page into a layout
 * @param  {String} page
 * @param  {String} layout
 * @return {String}
 */
const wrapPage = function(page, layout) {
	return layout.replace(/\{\%\s?body\s?\%\}/g, page);
};

/**
 * Parse each material - collect data, create partial
 */
const parseMaterials = function() {
	// reset object
	assembly.materials = {};

	// get files and dirs
	const files = globby.sync(options.materials, { nodir: true, nosort: true });

	// build a glob for identifying directories
	options.materials =
		typeof options.materials === 'string'
			? [options.materials]
			: options.materials;
	const dirsGlob = options.materials.map(pattern => {
		return `${path.dirname(pattern)}/*/`;
	});

	// get all directories
	// do a new glob; trailing slash matches only dirs
	const dirs = globby.sync(dirsGlob).map(dir => {
		return path
			.normalize(dir)
			.split(path.sep)
			.slice(-2, -1)[0];
	});

	// TODO investigate this - its using isSubCollection to do work
	// stub out an object for each collection and subCollection
	files.forEach(file => {
		const parent = getName(
			path
				.normalize(path.dirname(file))
				.split(path.sep)
				.slice(-2, -1)[0],
			true
		);
		const collection = getName(
			path.normalize(path.dirname(file)).split(path.sep)[1],
			true
		);
		const isSubCollection = dirs.indexOf(parent) > -1;

		// get the material base dir for stubbing out the base object for each category (e.g. component, structure)
		const materialBase = isSubCollection ? parent : collection;

		// stub the base object
		assembly.materials[materialBase] = assembly.materials[materialBase] || {
			name: toTitleCase(getName(materialBase)),
			items: {},
		};

		if (isSubCollection) {
			assembly.materials[parent].items[collection] = assembly.materials[
				parent
			].items[collection] || {
				name: toTitleCase(getName(collection)),
				items: {},
			};
		}
	});

	// iterate over each file (material)
	files.forEach(file => {
		// get info
		const fileMatter = getMatter(file);
		const parent = path
			.normalize(path.dirname(file))
			.split(path.sep)
			.slice(-2, -1)[0];
		// Prevent partials from showing up like Modal.Modal
		// var collection = getName(path.normalize(path.dirname(file)).split(path.sep).pop(), true);
		// var isSubCollection = (dirs.indexOf(parent) > -1);
		const collection = getName(
			path.normalize(path.dirname(file)).split(path.sep)[1],
			true
		);
		const isSubCollection = false;
		const id = isSubCollection
			? `${getName(collection)}.${getName(file)}`
			: getName(file);
		const key = isSubCollection
			? `${collection}.${getName(file, true)}`
			: getName(file, true);

		// build filePath
		const dirname = path.normalize(path.dirname(file)).split(path.sep)[1];

		const collectionLink = dirname !== options.keys.views ? dirname : '';

		const urlPath = `${dirname}/${path
			.basename(file)
			.replace(/\.[0-9a-z]+$/, '.html')}`;

		// get material front-matter, omit `notes`
		const localData = _.omit(fileMatter.data, 'notes');

		// trim whitespace from material content
		let content = fileMatter.content.replace(
			/^(\s*(\r?\n|\r))+|(\s*(\r?\n|\r))+$/g,
			''
		);

		// capture meta data for the material
		if (!isSubCollection) {
			assembly.materials[collection].items[key] = {
				name: toTitleCase(id),
				url: urlPath,
				notes: fileMatter.data.notes
					? md.render(fileMatter.data.notes)
					: '',
				data: localData,
			};
		} else {
			assembly.materials[parent].items[collection].items[key] = {
				name: toTitleCase(id.split('.')[1]),
				url: urlPath,
				notes: fileMatter.data.notes
					? md.render(fileMatter.data.notes)
					: '',
				data: localData,
			};
		}

		// store material-name-spaced local data in template context
		if (
			Object.keys(localData).length !== 0 &&
			localData.constructor === Object
		) {
			if (assembly.data[id.replace(/\./g, '-')] === undefined) {
				assembly.data[id.replace(/\./g, '-')] = {};
			}
			Object.assign(assembly.data[id.replace(/\./g, '-')], localData);
		}

		// replace local fields on the fly with name-spaced keys
		// this allows partials to use local front-matter data
		// only affects the compilation environment
		if (!_.isEmpty(localData)) {
			_.forEach(localData, (val, key) => {
				// {{field}} => {{material-name.field}}
				const regex = new RegExp(
					`(\\{\\{[#\/]?)(\\s?${key}+?\\s?)(\\}\\})`,
					'g'
				);
				content = content.replace(regex, (match, p1, p2, p3) => {
					return `${p1 + id.replace(/\./g, '-')}.${p2.replace(
						/\s/g,
						''
					)}${p3}`;
				});
			});
		}

		// register the partial
		Handlebars.registerPartial(id, content);
	});

	// sort materials object alphabetically
	assembly.materials = sortObj(assembly.materials, 'order');

	for (const collection in assembly.materials) {
		assembly.materials[collection].items = sortObj(
			assembly.materials[collection].items,
			'order'
		);
	}
};

/**
 * Parse markdown files as "docs"
 */
const parseDocs = function() {
	// reset
	assembly.docs = {};

	// get files
	const files = globby.sync(options.docs, { nodir: true });

	// iterate over each file (material)
	files.forEach(file => {
		const id = getName(file);

		// save each as unique prop
		assembly.docs[id] = {
			name: toTitleCase(id),
			content: md.render(fs.readFileSync(file, 'utf-8')),
		};
	});
};

/**
 * Parse layout files
 */
const parseLayouts = function() {
	// reset
	assembly.layouts = {};

	// get files
	const files = globby.sync(options.layouts, { nodir: true });

	// save content of each file
	files.forEach(file => {
		const id = getName(file);
		const content = fs.readFileSync(file, 'utf-8');
		assembly.layouts[id] = content;
	});
};

/**
 * Register layout includes has Handlebars partials
 */
const parseLayoutIncludes = function() {
	// get files
	const files = globby.sync(options.layoutIncludes, { nodir: true });

	// save content of each file
	files.forEach(file => {
		const id = getName(file);
		const content = fs.readFileSync(file, 'utf-8');
		Handlebars.registerPartial(id, content);
	});
};

/**
 * Parse data files and save JSON
 */
const parseData = function() {
	// reset
	assembly.data = {};

	// get files
	const files = globby.sync(options.data, { nodir: true });

	// save content of each file
	files.forEach(file => {
		const id = getName(file);
		const content = yaml.safeLoad(fs.readFileSync(file, 'utf-8'));
		assembly.data[id] = content;
	});
};

/**
 * Get meta data for views
 */
const parseViews = function() {
	// reset
	assembly.views = {};

	// get files
	const files = globby.sync(options.views, { nodir: true });

	files.forEach(file => {
		const id = getName(file, true);

		// determine if view is part of a collection (subdir)
		const dirname = path
			.normalize(path.dirname(file))
			.split(path.sep)
			.pop();

		const collection = dirname !== options.keys.views ? dirname : '';

		const fileMatter = getMatter(file);

		const fileData = _.omit(fileMatter.data, 'notes');

		// if this file is part of a collection
		if (collection) {
			// create collection if it doesn't exist
			assembly.views[collection] = assembly.views[collection] || {
				name: toTitleCase(collection),
				items: {},
			};

			// store view data
			assembly.views[collection].items[id] = {
				name: toTitleCase(id),
				data: fileData,
			};
		}
	});
};

/**
 * Register new Handlebars helpers
 */
const registerHelpers = function() {
	// get helper files
	const resolveHelper = path.join.bind(null, __dirname, 'helpers');
	const localHelpers = fs.readdirSync(resolveHelper());
	const userHelpers = options.helpers;

	// register local helpers
	localHelpers.map(helper => {
		const key = helper.match(/(^\w+?-)(.+)(\.\w+)/)[2];
		const path = resolveHelper(helper);
		Handlebars.registerHelper(key, require(path));
	});

	// register user helpers
	for (const helper in userHelpers) {
		if (userHelpers.hasOwnProperty(helper)) {
			Handlebars.registerHelper(helper, userHelpers[helper]);
		}
	}

	/**
	 * Helpers that require local functions like `buildContext()`
	 */

	/**
	 * `material`
	 * @description Like a normal partial include (`{{> partialName }}`),
	 * but with some additional templating logic to help with nested block iterations.
	 * The name of the helper is the singular form of whatever is defined as the `options.keys.materials`
	 * @example
	 * {{material name context}}
	 */
	Handlebars.registerHelper(
		inflect.singularize(options.keys.materials),
		(name, context, opts) => {
			// remove leading numbers from name keyword
			// partials are always registered with the leading numbers removed
			// This is for both the subCollection as the file(name) itself!
			const key = name
				.replace(/(\d+[\-\.])+/, '')
				.replace(/(\d+[\-\.])+/, '');

			// attempt to find pre-compiled partial
			const template = Handlebars.partials[key];

			let fn;

			// compile partial if not already compiled
			if (!_.isFunction(template)) {
				fn = Handlebars.compile(template);
			} else {
				fn = template;
			}
			// return beautified html with trailing whitespace removed
			return beautifyHtml(
				fn(buildContext(context, opts.hash)).replace(/^\s+/, ''),
				options.beautifier
			);
		}
	);
};

/**
 * Setup the assembly
 * @param  {Objet} options  User options
 */
const setup = function(userOptions, isDev) {
	// merge user options with defaults
	options = _.merge({}, defaults, userOptions);

	// setup steps
	registerHelpers();
	parseLayouts();
	parseLayoutIncludes();
	parseData();
	parseMaterials();
	parseViews();
	parseDocs();
};

/**
 * Assemble views using materials, data, and docs
 */
const assemble = function() {
	// get files
	const files = globby.sync(options.views, { nodir: true });

	// create output directory if it doesn't already exist
	mkdirp.sync(options.dest);

	// iterate over each view
	files.forEach(file => {
		const id = getName(file);

		// build filePath
		const dirname = path
			.normalize(path.dirname(file))
			.split(path.sep)
			.pop();

		const collection = dirname !== options.keys.views ? dirname : '';

		let filePath = path.normalize(
			path.join(options.dest, collection, path.basename(file))
		);

		// get page gray matter and content
		const pageMatter = getMatter(file);

		const pageContent = pageMatter.content;

		if (collection) {
			pageMatter.data.baseurl = '..';
		}

		if (options.baseUrl && options.baseUrl.length > 0) {
			pageMatter.data.baseurl = options.baseUrl;
		}

		pageMatter.data.GLOBAL = options.GLOBAL;

		// template using Handlebars
		const source = wrapPage(
			pageContent,
			assembly.layouts[pageMatter.data.layout || options.layout]
		);

		const context = buildContext(pageMatter.data);

		const template = Handlebars.compile(source);

		// redefine file path if dest front-matter variable is defined
		if (pageMatter.data.dest) {
			filePath = path.normalize(pageMatter.data.dest);
		}

		if (options.destMap[collection]) {
			filePath = path.normalize(
				path.join(options.destMap[collection], path.basename(file))
			);
		}

		// change extension to .html
		filePath = filePath.replace(/\.[0-9a-z]+$/, options.extension);

		// write file
		mkdirp.sync(path.dirname(filePath));
		try {
			fs.writeFileSync(filePath, template(context));
		} catch (e) {
			const originFilePath = `${path.dirname(file)}/${path.basename(
				file
			)}`;

			console.error(
				'\x1b[31m \x1b[1mBold',
				'Error while comiling template',
				originFilePath,
				'\x1b[0m \n'
			);
			throw e;
		}

		// write a copy file if custom dest-copy front-matter variable is defined
		if (pageMatter.data['dest-copy']) {
			const copyPath = path.normalize(pageMatter.data['dest-copy']);
			mkdirp.sync(path.dirname(copyPath));
			fs.writeFileSync(copyPath, template(context));
		}
	});
};

// create individual dev pages
const dev = function() {
	// get files
	const files = globby.sync(options.materials, { nodir: true });

	// create output directory if it doesn't already exist
	mkdirp.sync(options.dest);

	// iterate over each view
	files.forEach(file => {
		const id = getName(file);

		// build filePath
		const dirname = path.normalize(path.dirname(file)).split(path.sep)[1];

		const collection = dirname !== options.keys.views ? dirname : '';

		let filePath = path.normalize(
			path.join(options.dest, collection, path.basename(file))
		);

		// get page gray matter and content
		const pageMatter = getMatter(file);

		const pageContent = pageMatter.content;

		const jsonMatter =
			assembly.data[path.basename(file).replace(/\.[0-9a-z]+$/, '')];

		// if json file exsits add front matter to the json variations
		if (jsonMatter && jsonMatter.variations) {
			if (pageMatter.data.themes) {
				jsonMatter.variations = [
					pageMatter.data,
					...jsonMatter.variations,
				];
				pageMatter.data.themes.forEach(theme => {
					pageMatter.data.theme = theme;
					jsonMatter.variations = [
						pageMatter.data,
						...jsonMatter.variations,
					];
				});
			}
			Object.assign(pageMatter.data, jsonMatter);
		}

		if (collection) {
			pageMatter.data.baseurl = '..';
		}

		if (options.baseUrl && options.baseUrl.length > 0) {
			pageMatter.data.baseurl = options.baseUrl;
		}
		pageMatter.data.guideurl = `/${dirname}.html#${id}`;
		pageMatter.data.GLOBAL = options.GLOBAL;

		// template using Handlebars
		const layout = pageMatter.data.layout || options.devlayout;
		const source = wrapPage(pageContent, assembly.layouts[layout]);

		const context = buildContext(pageMatter.data);

		const template = Handlebars.compile(source);

		// redefine file path if dest front-matter variable is defined
		if (pageMatter.data.dest) {
			filePath = path.normalize(pageMatter.data.dest);
		}

		if (options.destMap[collection]) {
			filePath = path.normalize(
				path.join(options.destMap[collection], path.basename(file))
			);
		}

		// change extension to .html
		filePath = filePath.replace(/\.[0-9a-z]+$/, options.extension);

		// write file
		// For each variation in .json file
		mkdirp.sync(path.dirname(filePath));
		try {
			fs.writeFileSync(filePath, template(context));
		} catch (e) {
			const originFilePath = `${path.dirname(file)}/${path.basename(
				file
			)}`;

			console.error(
				'\x1b[31m \x1b[1mBold',
				'Error while comiling template',
				originFilePath,
				'\x1b[0m \n'
			);
			throw e;
		}

		// write a copy file if custom dest-copy front-matter variable is defined
		if (pageMatter.data['dest-copy']) {
			const copyPath = path.normalize(pageMatter.data['dest-copy']);
			mkdirp.sync(path.dirname(copyPath));
			fs.writeFileSync(copyPath, template(context));
		}
	});
};

/**
 * Module exports
 * @return {Object} Promise
 */
module.exports = function(options, isDev) {
	try {
		// setup assembly
		setup(options, isDev);

		if (!isDev) {
			assemble();
			dev();
		} else {
			dev();
		}
	} catch (e) {
		handleError(e);
	}
};
