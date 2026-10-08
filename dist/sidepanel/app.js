// node_modules/dompurify/dist/purify.es.mjs
function _OverloadYield(e, d) {
  this.v = e, this.k = d;
}
function _arrayLikeToArray(r, a) {
  (null == a || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r)) return r;
}
function _iterableToArrayLimit(r, l) {
  var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
  if (null != t) {
    var e, n, i, u, a = [], f = true, o = false;
    try {
      if (i = (t = t.call(r)).next, 0 === l) {
        if (Object(t) !== t) return;
        f = false;
      } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true) ;
    } catch (r2) {
      o = true, n = r2;
    } finally {
      try {
        if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
      } finally {
        if (o) throw n;
      }
    }
    return a;
  }
}
function _nonIterableRest() {
  throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if ("string" == typeof r) return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
  }
}
function AsyncGenerator(e) {
  var t, n;
  function resume(t2, n2) {
    try {
      var r = e[t2](n2), o = r.value, u = o instanceof _OverloadYield;
      Promise.resolve(u ? o.v : o).then(function(n3) {
        if (u) {
          var i = "return" === t2 && o.k ? t2 : "next";
          if (!o.k || n3.done) return resume(i, n3);
          n3 = e[i](n3).value;
        }
        settle(!!r.done, n3);
      }, function(e2) {
        resume("throw", e2);
      });
    } catch (e2) {
      settle(2, e2);
    }
  }
  function settle(e2, r) {
    2 === e2 ? t.reject(r) : t.resolve({
      value: r,
      done: e2
    }), (t = t.next) ? resume(t.key, t.arg) : n = null;
  }
  this._invoke = function(e2, r) {
    return new Promise(function(o, u) {
      var i = {
        key: e2,
        arg: r,
        resolve: o,
        reject: u,
        next: null
      };
      n ? n = n.next = i : (t = n = i, resume(e2, r));
    });
  }, "function" != typeof e.return && (this.return = void 0);
}
AsyncGenerator.prototype["function" == typeof Symbol && Symbol.asyncIterator || "@@asyncIterator"] = function() {
  return this;
}, AsyncGenerator.prototype.next = function(e) {
  return this._invoke("next", e);
}, AsyncGenerator.prototype.throw = function(e) {
  return this._invoke("throw", e);
}, AsyncGenerator.prototype.return = function(e) {
  return this._invoke("return", e);
};
var entries = Object.entries;
var setPrototypeOf = Object.setPrototypeOf;
var isFrozen = Object.isFrozen;
var getPrototypeOf = Object.getPrototypeOf;
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var freeze = Object.freeze;
var seal = Object.seal;
var create = Object.create;
var _ref = typeof Reflect !== "undefined" && Reflect;
var apply = _ref.apply;
var construct = _ref.construct;
if (!freeze) freeze = function freeze2(x) {
  return x;
};
if (!seal) seal = function seal2(x) {
  return x;
};
if (!apply) apply = function apply2(func, thisArg) {
  for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
  return func.apply(thisArg, args);
};
if (!construct) construct = function construct2(Func) {
  for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) args[_key2 - 1] = arguments[_key2];
  return new Func(...args);
};
var arrayForEach = unapply(Array.prototype.forEach);
Array.prototype.indexOf;
var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
var arrayPop = unapply(Array.prototype.pop);
var arrayPush = unapply(Array.prototype.push);
Array.prototype.slice;
var arraySplice = unapply(Array.prototype.splice);
var arrayIsArray = Array.isArray;
var stringToLowerCase = unapply(String.prototype.toLowerCase);
var stringToString = unapply(String.prototype.toString);
var stringMatch = unapply(String.prototype.match);
var stringReplace = unapply(String.prototype.replace);
var stringIndexOf = unapply(String.prototype.indexOf);
var stringTrim = unapply(String.prototype.trim);
var numberToString = unapply(Number.prototype.toString);
var booleanToString = unapply(Boolean.prototype.toString);
var bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
var symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
var objectToString = unapply(Object.prototype.toString);
var regExpTest = unapply(RegExp.prototype.test);
var typeErrorCreate = unconstruct(TypeError);
function unapply(func) {
  return function(thisArg) {
    if (thisArg instanceof RegExp) thisArg.lastIndex = 0;
    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) args[_key3 - 1] = arguments[_key3];
    return apply(func, thisArg, args);
  };
}
function unconstruct(Func) {
  return function() {
    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) args[_key4] = arguments[_key4];
    return construct(Func, args);
  };
}
function addToSet(set, array) {
  let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
  if (setPrototypeOf) setPrototypeOf(set, null);
  if (!arrayIsArray(array)) return set;
  let l = array.length;
  while (l--) {
    let element = array[l];
    if (typeof element === "string") {
      const lcElement = transformCaseFunc(element);
      if (lcElement !== element) {
        if (!isFrozen(array)) array[l] = lcElement;
        element = lcElement;
      }
    }
    set[element] = true;
  }
  return set;
}
function cleanArray(array) {
  for (let index = 0; index < array.length; index++) if (!objectHasOwnProperty(array, index)) array[index] = null;
  return array;
}
function clone(object) {
  const newObject = create(null);
  for (const _ref2 of entries(object)) {
    var _ref3 = _slicedToArray(_ref2, 2);
    const property = _ref3[0];
    const value = _ref3[1];
    if (objectHasOwnProperty(object, property)) {
      if (arrayIsArray(value)) newObject[property] = cleanArray(value);
      else if (value && typeof value === "object" && value.constructor === Object) newObject[property] = clone(value);
      else newObject[property] = value;
    }
  }
  return newObject;
}
function stringifyValue(value) {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
      return numberToString(value);
    case "boolean":
      return booleanToString(value);
    case "bigint":
      return bigintToString ? bigintToString(value) : "0";
    case "symbol":
      return symbolToString ? symbolToString(value) : "Symbol()";
    case "undefined":
      return objectToString(value);
    case "function":
    case "object": {
      if (value === null) return objectToString(value);
      const valueAsRecord = value;
      const valueToString = lookupGetter(valueAsRecord, "toString");
      if (typeof valueToString === "function") {
        const stringified = valueToString(valueAsRecord);
        return typeof stringified === "string" ? stringified : objectToString(stringified);
      }
      return objectToString(value);
    }
    default:
      return objectToString(value);
  }
}
function lookupGetter(object, prop) {
  while (object !== null) {
    const desc = getOwnPropertyDescriptor(object, prop);
    if (desc) {
      if (desc.get) return unapply(desc.get);
      if (typeof desc.value === "function") return unapply(desc.value);
    }
    object = getPrototypeOf(object);
  }
  function fallbackValue() {
    return null;
  }
  return fallbackValue;
}
function isRegex(value) {
  try {
    regExpTest(value, "");
    return true;
  } catch (_unused) {
    return false;
  }
}
var html$1 = freeze([
  "a",
  "abbr",
  "acronym",
  "address",
  "area",
  "article",
  "aside",
  "audio",
  "b",
  "bdi",
  "bdo",
  "big",
  "blink",
  "blockquote",
  "body",
  "br",
  "button",
  "canvas",
  "caption",
  "center",
  "cite",
  "code",
  "col",
  "colgroup",
  "content",
  "data",
  "datalist",
  "dd",
  "decorator",
  "del",
  "details",
  "dfn",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "element",
  "em",
  "fieldset",
  "figcaption",
  "figure",
  "font",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hgroup",
  "hr",
  "html",
  "i",
  "img",
  "input",
  "ins",
  "kbd",
  "label",
  "legend",
  "li",
  "main",
  "map",
  "mark",
  "marquee",
  "menu",
  "menuitem",
  "meter",
  "nav",
  "nobr",
  "ol",
  "optgroup",
  "option",
  "output",
  "p",
  "picture",
  "pre",
  "progress",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "search",
  "section",
  "select",
  "shadow",
  "slot",
  "small",
  "source",
  "spacer",
  "span",
  "strike",
  "strong",
  "style",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "template",
  "textarea",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "track",
  "tt",
  "u",
  "ul",
  "var",
  "video",
  "wbr"
]);
var svg$1 = freeze([
  "svg",
  "a",
  "altglyph",
  "altglyphdef",
  "altglyphitem",
  "animatecolor",
  "animatemotion",
  "animatetransform",
  "circle",
  "clippath",
  "defs",
  "desc",
  "ellipse",
  "enterkeyhint",
  "exportparts",
  "filter",
  "font",
  "g",
  "glyph",
  "glyphref",
  "hkern",
  "image",
  "inputmode",
  "line",
  "lineargradient",
  "marker",
  "mask",
  "metadata",
  "mpath",
  "part",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialgradient",
  "rect",
  "stop",
  "style",
  "switch",
  "symbol",
  "text",
  "textpath",
  "title",
  "tref",
  "tspan",
  "view",
  "vkern"
]);
var svgFilters = freeze([
  "feBlend",
  "feColorMatrix",
  "feComponentTransfer",
  "feComposite",
  "feConvolveMatrix",
  "feDiffuseLighting",
  "feDisplacementMap",
  "feDistantLight",
  "feDropShadow",
  "feFlood",
  "feFuncA",
  "feFuncB",
  "feFuncG",
  "feFuncR",
  "feGaussianBlur",
  "feImage",
  "feMerge",
  "feMergeNode",
  "feMorphology",
  "feOffset",
  "fePointLight",
  "feSpecularLighting",
  "feSpotLight",
  "feTile",
  "feTurbulence"
]);
var svgDisallowed = freeze([
  "animate",
  "color-profile",
  "cursor",
  "discard",
  "font-face",
  "font-face-format",
  "font-face-name",
  "font-face-src",
  "font-face-uri",
  "foreignobject",
  "hatch",
  "hatchpath",
  "mesh",
  "meshgradient",
  "meshpatch",
  "meshrow",
  "missing-glyph",
  "script",
  "set",
  "solidcolor",
  "unknown",
  "use"
]);
var mathMl$1 = freeze([
  "math",
  "menclose",
  "merror",
  "mfenced",
  "mfrac",
  "mglyph",
  "mi",
  "mlabeledtr",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mroot",
  "mrow",
  "ms",
  "mspace",
  "msqrt",
  "mstyle",
  "msub",
  "msup",
  "msubsup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "mprescripts"
]);
var mathMlDisallowed = freeze([
  "maction",
  "maligngroup",
  "malignmark",
  "mlongdiv",
  "mscarries",
  "mscarry",
  "msgroup",
  "mstack",
  "msline",
  "msrow",
  "semantics",
  "annotation",
  "annotation-xml",
  "mprescripts",
  "none"
]);
var text = freeze(["#text"]);
var html = freeze([
  "accept",
  "action",
  "align",
  "alt",
  "autocapitalize",
  "autocomplete",
  "autopictureinpicture",
  "autoplay",
  "background",
  "bgcolor",
  "border",
  "capture",
  "cellpadding",
  "cellspacing",
  "checked",
  "cite",
  "class",
  "clear",
  "color",
  "cols",
  "colspan",
  "command",
  "commandfor",
  "controls",
  "controlslist",
  "coords",
  "crossorigin",
  "datetime",
  "decoding",
  "default",
  "dir",
  "disabled",
  "disablepictureinpicture",
  "disableremoteplayback",
  "download",
  "draggable",
  "enctype",
  "enterkeyhint",
  "exportparts",
  "face",
  "for",
  "headers",
  "height",
  "hidden",
  "high",
  "href",
  "hreflang",
  "id",
  "inert",
  "inputmode",
  "integrity",
  "ismap",
  "kind",
  "label",
  "lang",
  "list",
  "loading",
  "loop",
  "low",
  "max",
  "maxlength",
  "media",
  "method",
  "min",
  "minlength",
  "multiple",
  "muted",
  "name",
  "nonce",
  "noshade",
  "novalidate",
  "nowrap",
  "open",
  "optimum",
  "part",
  "pattern",
  "placeholder",
  "playsinline",
  "popover",
  "popovertarget",
  "popovertargetaction",
  "poster",
  "preload",
  "pubdate",
  "radiogroup",
  "readonly",
  "rel",
  "required",
  "rev",
  "reversed",
  "role",
  "rows",
  "rowspan",
  "spellcheck",
  "scope",
  "selected",
  "shape",
  "size",
  "sizes",
  "slot",
  "span",
  "srclang",
  "start",
  "src",
  "srcset",
  "step",
  "style",
  "summary",
  "tabindex",
  "title",
  "translate",
  "type",
  "usemap",
  "valign",
  "value",
  "width",
  "wrap",
  "xmlns"
]);
var svg = freeze([
  "accent-height",
  "accumulate",
  "additive",
  "alignment-baseline",
  "amplitude",
  "ascent",
  "attributename",
  "attributetype",
  "azimuth",
  "basefrequency",
  "baseline-shift",
  "begin",
  "bias",
  "by",
  "class",
  "clip",
  "clippathunits",
  "clip-path",
  "clip-rule",
  "color",
  "color-interpolation",
  "color-interpolation-filters",
  "color-profile",
  "color-rendering",
  "cx",
  "cy",
  "d",
  "dx",
  "dy",
  "diffuseconstant",
  "direction",
  "display",
  "divisor",
  "dominant-baseline",
  "dur",
  "edgemode",
  "elevation",
  "end",
  "exponent",
  "fill",
  "fill-opacity",
  "fill-rule",
  "filter",
  "filterunits",
  "flood-color",
  "flood-opacity",
  "font-family",
  "font-size",
  "font-size-adjust",
  "font-stretch",
  "font-style",
  "font-variant",
  "font-weight",
  "fx",
  "fy",
  "g1",
  "g2",
  "glyph-name",
  "glyphref",
  "gradientunits",
  "gradienttransform",
  "height",
  "href",
  "id",
  "image-rendering",
  "in",
  "in2",
  "intercept",
  "k",
  "k1",
  "k2",
  "k3",
  "k4",
  "kerning",
  "keypoints",
  "keysplines",
  "keytimes",
  "lang",
  "lengthadjust",
  "letter-spacing",
  "kernelmatrix",
  "kernelunitlength",
  "lighting-color",
  "local",
  "marker-end",
  "marker-mid",
  "marker-start",
  "markerheight",
  "markerunits",
  "markerwidth",
  "maskcontentunits",
  "maskunits",
  "max",
  "mask",
  "mask-type",
  "media",
  "method",
  "mode",
  "min",
  "name",
  "numoctaves",
  "offset",
  "operator",
  "opacity",
  "order",
  "orient",
  "orientation",
  "origin",
  "overflow",
  "paint-order",
  "path",
  "pathlength",
  "patterncontentunits",
  "patterntransform",
  "patternunits",
  "pointer-events",
  "points",
  "preservealpha",
  "preserveaspectratio",
  "primitiveunits",
  "r",
  "rx",
  "ry",
  "radius",
  "refx",
  "refy",
  "repeatcount",
  "repeatdur",
  "restart",
  "result",
  "rotate",
  "scale",
  "seed",
  "shape-rendering",
  "slope",
  "specularconstant",
  "specularexponent",
  "spreadmethod",
  "startoffset",
  "stddeviation",
  "stitchtiles",
  "stop-color",
  "stop-opacity",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke",
  "stroke-width",
  "style",
  "surfacescale",
  "systemlanguage",
  "tabindex",
  "tablevalues",
  "targetx",
  "targety",
  "transform",
  "transform-origin",
  "text-anchor",
  "text-decoration",
  "text-orientation",
  "text-rendering",
  "textlength",
  "type",
  "u1",
  "u2",
  "unicode",
  "values",
  "vector-effect",
  "viewbox",
  "visibility",
  "version",
  "vert-adv-y",
  "vert-origin-x",
  "vert-origin-y",
  "width",
  "word-spacing",
  "wrap",
  "writing-mode",
  "xchannelselector",
  "ychannelselector",
  "x",
  "x1",
  "x2",
  "xmlns",
  "y",
  "y1",
  "y2",
  "z",
  "zoomandpan"
]);
var mathMl = freeze([
  "accent",
  "accentunder",
  "align",
  "bevelled",
  "close",
  "columnalign",
  "columnlines",
  "columnspacing",
  "columnspan",
  "denomalign",
  "depth",
  "dir",
  "display",
  "displaystyle",
  "encoding",
  "fence",
  "frame",
  "height",
  "href",
  "id",
  "largeop",
  "length",
  "linethickness",
  "lquote",
  "lspace",
  "mathbackground",
  "mathcolor",
  "mathsize",
  "mathvariant",
  "maxsize",
  "minsize",
  "movablelimits",
  "notation",
  "numalign",
  "open",
  "rowalign",
  "rowlines",
  "rowspacing",
  "rowspan",
  "rspace",
  "rquote",
  "scriptlevel",
  "scriptminsize",
  "scriptsizemultiplier",
  "selection",
  "separator",
  "separators",
  "stretchy",
  "subscriptshift",
  "supscriptshift",
  "symmetric",
  "voffset",
  "width",
  "xmlns"
]);
var xml = freeze([
  "xlink:href",
  "xml:id",
  "xlink:title",
  "xml:space",
  "xmlns:xlink"
]);
var MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
var ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
var TMPLIT_EXPR = seal(/\${[\w\W]*/g);
var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
var IS_ALLOWED_URI = seal(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i);
var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
var ATTR_WHITESPACE = seal(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g);
var DOCTYPE_NAME = seal(/^html$/i);
var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
var ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
var COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
var FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
var SELF_CLOSING_TAG = seal(/\/>/i);
var NODE_TYPE = {
  element: 1,
  attribute: 2,
  text: 3,
  cdataSection: 4,
  entityReference: 5,
  entityNode: 6,
  processingInstruction: 7,
  comment: 8,
  document: 9,
  documentType: 10,
  documentFragment: 11,
  notation: 12
};
var LITERAL_TEXT_ELEMENT_NAMES = [
  "style",
  "script",
  "xmp",
  "iframe",
  "noembed",
  "noframes",
  "plaintext",
  "noscript"
];
var LITERAL_TEXT_ELEMENTS = freeze(addToSet({}, LITERAL_TEXT_ELEMENT_NAMES));
var LITERAL_TEXT_CLOSE = (function() {
  const map = {};
  arrayForEach(LITERAL_TEXT_ELEMENT_NAMES, (name) => {
    map[name] = seal(new RegExp("</" + name + "(?=[\\t\\n\\f\\r />])", "i"));
  });
  return freeze(map);
})();
var getGlobal = function getGlobal2() {
  return typeof window === "undefined" ? null : window;
};
var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
  if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") return null;
  let suffix = null;
  const ATTR_NAME = "data-tt-policy-suffix";
  if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) suffix = purifyHostElement.getAttribute(ATTR_NAME);
  const policyName = "dompurify" + (suffix ? "#" + suffix : "");
  try {
    return trustedTypes.createPolicy(policyName, {
      createHTML(html3) {
        return html3;
      },
      createScriptURL(scriptUrl) {
        return scriptUrl;
      }
    });
  } catch (_) {
    console.warn("TrustedTypes policy " + policyName + " could not be created.");
    return null;
  }
};
var _createHooksMap = function _createHooksMap2() {
  return {
    afterSanitizeAttributes: [],
    afterSanitizeElements: [],
    afterSanitizeShadowDOM: [],
    beforeSanitizeAttributes: [],
    beforeSanitizeElements: [],
    beforeSanitizeShadowDOM: [],
    uponSanitizeAttribute: [],
    uponSanitizeElement: [],
    uponSanitizeShadowNode: []
  };
};
var _resolveSetOption = function _resolveSetOption2(cfg, key, fallback, options2) {
  return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options2.base ? clone(options2.base) : {}, cfg[key], options2.transform) : fallback;
};
var _resolveObjectOption = function _resolveObjectOption2(cfg, key, makeFallback) {
  const value = objectHasOwnProperty(cfg, key) ? cfg[key] : void 0;
  return value && typeof value === "object" ? clone(value) : makeFallback();
};
function createDOMPurify() {
  let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
  const DOMPurify = (root) => createDOMPurify(root);
  DOMPurify.version = "3.4.16";
  DOMPurify.removed = [];
  if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
    DOMPurify.isSupported = false;
    return DOMPurify;
  }
  let document2 = window2.document;
  const originalDocument = document2;
  const currentScript = originalDocument.currentScript;
  window2.DocumentFragment;
  const HTMLTemplateElement = window2.HTMLTemplateElement, Node = window2.Node, Element = window2.Element, NodeFilter = window2.NodeFilter;
  window2.NamedNodeMap === void 0 && (window2.NamedNodeMap || window2.MozNamedAttrMap);
  window2.HTMLFormElement;
  const DOMParser = window2.DOMParser, trustedTypes = window2.trustedTypes;
  const ElementPrototype = Element.prototype;
  const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
  const remove = lookupGetter(ElementPrototype, "remove");
  const removeAttributeNode = lookupGetter(ElementPrototype, "removeAttributeNode");
  const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
  const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
  const getParentNode = lookupGetter(ElementPrototype, "parentNode");
  const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
  const getAttributes = lookupGetter(ElementPrototype, "attributes");
  const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
  const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
  const getOwnerDocument = Node && Node.prototype ? lookupGetter(Node.prototype, "ownerDocument") : null;
  const _readNodeType = function _readNodeType2(node) {
    return getNodeType ? getNodeType(node) : node.nodeType;
  };
  const _readNodeName = function _readNodeName2(node) {
    return getNodeName ? getNodeName(node) : node.nodeName;
  };
  if (typeof HTMLTemplateElement === "function") {
    const template = document2.createElement("template");
    if (template.content && template.content.ownerDocument) document2 = template.content.ownerDocument;
  }
  let trustedTypesPolicy;
  let emptyHTML = "";
  let defaultTrustedTypesPolicy;
  let defaultTrustedTypesPolicyResolved = false;
  let IN_TRUSTED_TYPES_POLICY = 0;
  const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy2() {
    if (IN_TRUSTED_TYPES_POLICY > 0) throw typeErrorCreate('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.');
  };
  const _createTrustedHTML = function _createTrustedHTML2(html3) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createHTML(html3);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _createTrustedScriptURL = function _createTrustedScriptURL2(scriptUrl) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createScriptURL(scriptUrl);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy2() {
    if (!defaultTrustedTypesPolicyResolved) {
      defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
      defaultTrustedTypesPolicyResolved = true;
    }
    return defaultTrustedTypesPolicy;
  };
  const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
  const importNode = originalDocument.importNode;
  let hooks = _createHooksMap();
  DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
  const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
  let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
  let ALLOWED_TAGS = null;
  const DEFAULT_ALLOWED_TAGS = addToSet({}, [
    ...html$1,
    ...svg$1,
    ...svgFilters,
    ...mathMl$1,
    ...text
  ]);
  let ALLOWED_ATTR = null;
  const DEFAULT_ALLOWED_ATTR = addToSet({}, [
    ...html,
    ...svg,
    ...mathMl,
    ...xml
  ]);
  let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
    tagNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    allowCustomizedBuiltInElements: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: false
    }
  }));
  let FORBID_TAGS = null;
  let FORBID_ATTR = null;
  const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
    tagCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    }
  }));
  let ALLOW_ARIA_ATTR = true;
  let ALLOW_DATA_ATTR = true;
  let ALLOW_UNKNOWN_PROTOCOLS = false;
  let ALLOW_SELF_CLOSE_IN_ATTR = true;
  let SAFE_FOR_TEMPLATES = false;
  let SAFE_FOR_XML = true;
  let WHOLE_DOCUMENT = false;
  let SET_CONFIG = false;
  let SET_CONFIG_ALLOWED_TAGS = null;
  let SET_CONFIG_ALLOWED_ATTR = null;
  let FORCE_BODY = false;
  let RETURN_DOM = false;
  let RETURN_DOM_FRAGMENT = false;
  let RETURN_TRUSTED_TYPE = false;
  let SANITIZE_DOM = true;
  let SANITIZE_NAMED_PROPS = false;
  const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
  let KEEP_CONTENT = true;
  let IN_PLACE = false;
  let USE_PROFILES = {};
  let FORBID_CONTENTS = null;
  const DEFAULT_FORBID_CONTENTS = addToSet({}, [
    "annotation-xml",
    "audio",
    "colgroup",
    "desc",
    "foreignobject",
    "head",
    "iframe",
    "math",
    "mi",
    "mn",
    "mo",
    "ms",
    "mtext",
    "noembed",
    "noframes",
    "noscript",
    "plaintext",
    "script",
    "selectedcontent",
    "style",
    "svg",
    "template",
    "thead",
    "title",
    "video",
    "xmp"
  ]);
  let DATA_URI_TAGS = null;
  const DEFAULT_DATA_URI_TAGS = addToSet({}, [
    "audio",
    "video",
    "img",
    "source",
    "image",
    "track"
  ]);
  let URI_SAFE_ATTRIBUTES = null;
  const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, [
    "alt",
    "class",
    "for",
    "id",
    "label",
    "name",
    "pattern",
    "placeholder",
    "role",
    "summary",
    "title",
    "value",
    "style",
    "xmlns"
  ]);
  const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  let NAMESPACE = HTML_NAMESPACE;
  let IS_EMPTY_INPUT = false;
  let ALLOWED_NAMESPACES = null;
  const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [
    MATHML_NAMESPACE,
    SVG_NAMESPACE,
    HTML_NAMESPACE
  ], stringToString);
  const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze([
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext"
  ]);
  let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
  const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
  let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
  const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, [
    "title",
    "style",
    "font",
    "a",
    "script"
  ]);
  let PARSER_MEDIA_TYPE = null;
  const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
  const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
  let transformCaseFunc = null;
  let CONFIG = null;
  const formElement = document2.createElement("form");
  const isRegexOrFunction = function isRegexOrFunction2(testValue) {
    return testValue instanceof RegExp || testValue instanceof Function;
  };
  const _parseConfig = function _parseConfig2() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    if (CONFIG && CONFIG === cfg) return;
    if (!cfg || typeof cfg !== "object") cfg = {};
    cfg = clone(cfg);
    PARSER_MEDIA_TYPE = SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
    transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
    ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, { transform: transformCaseFunc });
    ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, { transform: transformCaseFunc });
    ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, { transform: stringToString });
    URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
      transform: transformCaseFunc,
      base: DEFAULT_URI_SAFE_ATTRIBUTES
    });
    DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
      transform: transformCaseFunc,
      base: DEFAULT_DATA_URI_TAGS
    });
    FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, { transform: transformCaseFunc });
    FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), { transform: transformCaseFunc });
    FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), { transform: transformCaseFunc });
    USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
    ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
    ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
    ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
    ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
    SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
    SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
    WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
    RETURN_DOM = cfg.RETURN_DOM || false;
    RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
    RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
    FORCE_BODY = cfg.FORCE_BODY || false;
    SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
    SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
    KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
    IN_PLACE = cfg.IN_PLACE || false;
    IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
    NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
    MATHML_TEXT_INTEGRATION_POINTS = _resolveObjectOption(cfg, "MATHML_TEXT_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS));
    HTML_INTEGRATION_POINTS = _resolveObjectOption(cfg, "HTML_INTEGRATION_POINTS", () => addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS));
    const customElementHandling = _resolveObjectOption(cfg, "CUSTOM_ELEMENT_HANDLING", () => create(null));
    CUSTOM_ELEMENT_HANDLING = create(null);
    if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
    if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
    if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
    seal(CUSTOM_ELEMENT_HANDLING);
    if (SAFE_FOR_TEMPLATES) ALLOW_DATA_ATTR = false;
    if (RETURN_DOM_FRAGMENT) RETURN_DOM = true;
    if (USE_PROFILES) {
      ALLOWED_TAGS = addToSet({}, text);
      ALLOWED_ATTR = create(null);
      if (USE_PROFILES.html === true) {
        addToSet(ALLOWED_TAGS, html$1);
        addToSet(ALLOWED_ATTR, html);
      }
      if (USE_PROFILES.svg === true) {
        addToSet(ALLOWED_TAGS, svg$1);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.svgFilters === true) {
        addToSet(ALLOWED_TAGS, svgFilters);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.mathMl === true) {
        addToSet(ALLOWED_TAGS, mathMl$1);
        addToSet(ALLOWED_ATTR, mathMl);
        addToSet(ALLOWED_ATTR, xml);
      }
    }
    EXTRA_ELEMENT_HANDLING.tagCheck = null;
    EXTRA_ELEMENT_HANDLING.attributeCheck = null;
    if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
      if (typeof cfg.ADD_TAGS === "function") EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
      else if (arrayIsArray(cfg.ADD_TAGS)) {
        if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) ALLOWED_TAGS = clone(ALLOWED_TAGS);
        addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
      if (typeof cfg.ADD_ATTR === "function") EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
      else if (arrayIsArray(cfg.ADD_ATTR)) {
        if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) ALLOWED_ATTR = clone(ALLOWED_ATTR);
        addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) FORBID_CONTENTS = clone(FORBID_CONTENTS);
      addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
    }
    if (KEEP_CONTENT) ALLOWED_TAGS["#text"] = true;
    if (WHOLE_DOCUMENT) addToSet(ALLOWED_TAGS, [
      "html",
      "head",
      "body"
    ]);
    if (ALLOWED_TAGS.table) {
      addToSet(ALLOWED_TAGS, ["tbody"]);
      delete FORBID_TAGS.tbody;
    }
    if (cfg.TRUSTED_TYPES_POLICY) {
      if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
      if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
      const previousTrustedTypesPolicy = trustedTypesPolicy;
      trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
      try {
        emptyHTML = _createTrustedHTML("");
      } catch (error) {
        trustedTypesPolicy = previousTrustedTypesPolicy;
        throw error;
      }
    } else if (cfg.TRUSTED_TYPES_POLICY === null) {
      trustedTypesPolicy = void 0;
      emptyHTML = "";
    } else {
      if (trustedTypesPolicy === void 0) trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
      if (trustedTypesPolicy && typeof emptyHTML === "string") emptyHTML = _createTrustedHTML("");
    }
    if (freeze) freeze(cfg);
    CONFIG = cfg;
  };
  const ALL_SVG_TAGS = addToSet({}, [
    ...svg$1,
    ...svgFilters,
    ...svgDisallowed
  ]);
  const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
  const _checkSvgNamespace = function _checkSvgNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "svg";
    if (parent.namespaceURI === MATHML_NAMESPACE) return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
    return Boolean(ALL_SVG_TAGS[tagName]);
  };
  const _checkMathMlNamespace = function _checkMathMlNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) return tagName === "math";
    if (parent.namespaceURI === SVG_NAMESPACE) return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
    return Boolean(ALL_MATHML_TAGS[tagName]);
  };
  const _checkHtmlNamespace = function _checkHtmlNamespace2(tagName, parent, parentTagName) {
    if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) return false;
    if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) return false;
    return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
  };
  const _checkValidNamespace = function _checkValidNamespace2(element) {
    let parent = getParentNode(element);
    if (!parent || !parent.tagName) parent = {
      namespaceURI: NAMESPACE,
      tagName: "template"
    };
    const tagName = stringToLowerCase(element.tagName);
    const parentTagName = stringToLowerCase(parent.tagName);
    if (!ALLOWED_NAMESPACES[element.namespaceURI]) return false;
    if (element.namespaceURI === SVG_NAMESPACE) return _checkSvgNamespace(tagName, parent, parentTagName);
    if (element.namespaceURI === MATHML_NAMESPACE) return _checkMathMlNamespace(tagName, parent, parentTagName);
    if (element.namespaceURI === HTML_NAMESPACE) return _checkHtmlNamespace(tagName, parent, parentTagName);
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) return true;
    return false;
  };
  const _forceRemove = function _forceRemove2(node) {
    arrayPush(DOMPurify.removed, { element: node });
    try {
      getParentNode(node).removeChild(node);
    } catch (_) {
      remove(node);
      if (!getParentNode(node)) throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
    }
  };
  const _stripAttributeNode = function _stripAttributeNode2(element, attribute, name) {
    try {
      removeAttributeNode(element, attribute);
    } catch (_) {
      try {
        element.removeAttribute(name);
      } catch (_2) {
      }
    }
  };
  const _neutralizeRoot = function _neutralizeRoot2(root) {
    _neutralizeSubtree(root);
    const childNodes = getChildNodes(root);
    if (childNodes) {
      const snapshot = [];
      arrayForEach(childNodes, (child) => {
        arrayPush(snapshot, child);
      });
      arrayForEach(snapshot, (child) => {
        try {
          remove(child);
        } catch (_) {
        }
      });
    }
    const attributes = getAttributes(root);
    if (attributes) for (let i = attributes.length - 1; i >= 0; --i) {
      const attribute = attributes[i];
      const name = attribute && attribute.name;
      if (typeof name === "string") _stripAttributeNode(root, attribute, name);
    }
  };
  const _removeAttribute = function _removeAttribute2(name, element, attr) {
    if (!attr) try {
      attr = element.getAttributeNode(name);
    } catch (_) {
      attr = null;
    }
    arrayPush(DOMPurify.removed, {
      attribute: attr || null,
      from: element
    });
    try {
      if (attr) removeAttributeNode(element, attr);
      else element.removeAttribute(name);
    } catch (_) {
      try {
        element.removeAttribute(name);
      } catch (_2) {
      }
    }
    if (name === "is") {
      if (RETURN_DOM || RETURN_DOM_FRAGMENT) try {
        _forceRemove(element);
      } catch (_) {
      }
      else try {
        element.setAttribute(name, "");
      } catch (_) {
      }
    }
  };
  const _stripDisallowedAttributes = function _stripDisallowedAttributes2(element) {
    const attributes = getAttributes(element);
    if (!attributes) return;
    for (let i = attributes.length - 1; i >= 0; --i) {
      const attribute = attributes[i];
      const name = attribute && attribute.name;
      if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) continue;
      _stripAttributeNode(element, attribute, name);
    }
  };
  const _neutralizeSubtree = function _neutralizeSubtree2(root) {
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      if (_readNodeType(node) === NODE_TYPE.element) _stripDisallowedAttributes(node);
      const childNodes = getChildNodes(node);
      if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
    }
  };
  const _isPatchLinkageAttribute = function _isPatchLinkageAttribute2(lcName, lcTag) {
    if (!SAFE_FOR_XML) return false;
    if (lcName === "patchsrc") return true;
    return lcName === "for" && lcTag !== "label" && lcTag !== "output";
  };
  const _neutralizePatchLinkage = function _neutralizePatchLinkage2(root) {
    if (!SAFE_FOR_XML) return;
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      const nodeType = _readNodeType(node);
      if (nodeType === NODE_TYPE.processingInstruction || nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, node.data)) {
        try {
          remove(node);
        } catch (_) {
        }
        continue;
      }
      if (nodeType === NODE_TYPE.element) {
        const element = node;
        const lcTag = transformCaseFunc(_readNodeName(node));
        try {
          if (element.hasAttribute && element.hasAttribute("patchsrc")) element.removeAttribute("patchsrc");
          if (element.hasAttribute && element.hasAttribute("for") && _isPatchLinkageAttribute("for", lcTag)) element.removeAttribute("for");
        } catch (_) {
        }
      }
      const childNodes = getChildNodes(node);
      if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push(childNodes[i]);
    }
  };
  const _initDocument = function _initDocument2(dirty) {
    let doc = null;
    let leadingWhitespace = null;
    if (FORCE_BODY) dirty = "<remove></remove>" + dirty;
    else {
      const matches = stringMatch(dirty, /^[\r\n\t ]+/);
      leadingWhitespace = matches && matches[0];
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
    const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
    if (NAMESPACE === HTML_NAMESPACE) try {
      doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
    } catch (_) {
    }
    if (!doc || !doc.documentElement) {
      doc = implementation.createDocument(NAMESPACE, "template", null);
      try {
        doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
      } catch (_) {
      }
    }
    const body = doc.body || doc.documentElement;
    if (dirty && leadingWhitespace) body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
    if (NAMESPACE === HTML_NAMESPACE) return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
    return WHOLE_DOCUMENT ? doc.documentElement : body;
  };
  const _createNodeIterator = function _createNodeIterator2(root) {
    const doc = getOwnerDocument ? getOwnerDocument(root) : root.ownerDocument;
    return createNodeIterator.call(doc || root, root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION, null);
  };
  const _stripTemplateExpressions = function _stripTemplateExpressions2(value) {
    value = stringReplace(value, MUSTACHE_EXPR$1, " ");
    value = stringReplace(value, ERB_EXPR$1, " ");
    value = stringReplace(value, TMPLIT_EXPR$1, " ");
    return value;
  };
  const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
    var _node$querySelectorAl;
    node.normalize();
    const doc = getOwnerDocument ? getOwnerDocument(node) : node.ownerDocument;
    const walker = createNodeIterator.call(doc || node, node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION, null);
    let currentNode = walker.nextNode();
    while (currentNode) {
      currentNode.data = _stripTemplateExpressions(currentNode.data);
      currentNode = walker.nextNode();
    }
    const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === void 0 ? void 0 : _node$querySelectorAl.call(node, "template");
    if (templates) arrayForEach(templates, (tmpl) => {
      if (_isDocumentFragment(tmpl.content)) _scrubTemplateExpressions2(tmpl.content);
    });
  };
  const _isClobbered = function _isClobbered2(element) {
    const realTagName = getNodeName ? getNodeName(element) : null;
    if (typeof realTagName !== "string") return false;
    if (transformCaseFunc(realTagName) !== "form") return false;
    return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.removeAttributeNode !== "function" || typeof element.getAttributeNode !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || element.nodeType !== getNodeType(element) || element.childNodes !== getChildNodes(element);
  };
  const _isDocumentFragment = function _isDocumentFragment2(value) {
    if (!getNodeType || typeof value !== "object" || value === null) return false;
    try {
      return getNodeType(value) === NODE_TYPE.documentFragment;
    } catch (_) {
      return false;
    }
  };
  const _isNode = function _isNode2(value) {
    if (!getNodeType || typeof value !== "object" || value === null) return false;
    try {
      return typeof getNodeType(value) === "number";
    } catch (_) {
      return false;
    }
  };
  function _executeHooks(hooks2, currentNode, data) {
    if (hooks2.length === 0) return;
    arrayForEach(hooks2, (hook) => {
      hook.call(DOMPurify, currentNode, data, CONFIG);
    });
  }
  const _isUnsafeNode = function _isUnsafeNode2(currentNode, tagName) {
    if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) return true;
    if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && LITERAL_TEXT_ELEMENTS[tagName] && (_isNode(currentNode.firstElementChild) || typeof currentNode.textContent === "string" && regExpTest(LITERAL_TEXT_CLOSE[tagName], currentNode.textContent))) return true;
    if (currentNode.nodeType === NODE_TYPE.processingInstruction) return true;
    if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) return true;
    return false;
  };
  const _matchesNameCheck = function _matchesNameCheck2(check, name) {
    if (check instanceof RegExp) return regExpTest(check, name);
    if (check instanceof Function) {
      for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) args[_key - 2] = arguments[_key];
      return Boolean(check(name, ...args));
    }
    return false;
  };
  const _sanitizeDisallowedNode = function _sanitizeDisallowedNode2(currentNode, tagName, root) {
    if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) return false;
    if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
      const parentNode = getParentNode(currentNode);
      const childNodes = getChildNodes(currentNode);
      if (childNodes && parentNode) {
        const childCount = childNodes.length;
        for (let i = childCount - 1; i >= 0; --i) {
          const hoisted = currentNode === root ? cloneNode(childNodes[i], true) : childNodes[i];
          parentNode.insertBefore(hoisted, getNextSibling(currentNode));
        }
      }
    }
    _forceRemove(currentNode);
    return true;
  };
  const _forkSharedAllowlist = function _forkSharedAllowlist2(hookList, set, defaultSet, setConfigSet) {
    if (hookList.length === 0) return set;
    return set === defaultSet || set === setConfigSet ? clone(set) : set;
  };
  const _handleHookDetachedNode = function _handleHookDetachedNode2(currentNode, root) {
    if (currentNode === root || getParentNode(currentNode) !== null) return false;
    if (IN_PLACE) _neutralizeSubtree(currentNode);
    return true;
  };
  const _sanitizeElements = function _sanitizeElements2(currentNode, root) {
    _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
    if (_handleHookDetachedNode(currentNode, root)) return true;
    if (_isClobbered(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    const tagName = transformCaseFunc(_readNodeName(currentNode));
    ALLOWED_TAGS = _forkSharedAllowlist(hooks.uponSanitizeElement, ALLOWED_TAGS, DEFAULT_ALLOWED_TAGS, SET_CONFIG_ALLOWED_TAGS);
    _executeHooks(hooks.uponSanitizeElement, currentNode, {
      tagName,
      allowedTags: ALLOWED_TAGS
    });
    if (_handleHookDetachedNode(currentNode, root)) return true;
    if (_isUnsafeNode(currentNode, tagName)) {
      _forceRemove(currentNode);
      return true;
    }
    if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
      const removed = _sanitizeDisallowedNode(currentNode, tagName, root);
      if (removed === false) {
        _executeHooks(hooks.afterSanitizeElements, currentNode, null);
        if (_handleHookDetachedNode(currentNode, root)) return true;
      }
      return removed;
    }
    if (_readNodeType(currentNode) === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
      _forceRemove(currentNode);
      return true;
    }
    if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
      const content = _stripTemplateExpressions(currentNode.textContent);
      if (currentNode.textContent !== content) {
        arrayPush(DOMPurify.removed, { element: currentNode.cloneNode() });
        currentNode.textContent = content;
      }
    }
    _executeHooks(hooks.afterSanitizeElements, currentNode, null);
    return _handleHookDetachedNode(currentNode, root);
  };
  const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
    if (FORBID_ATTR[lcName]) return false;
    if (_isPatchLinkageAttribute(lcName, lcTag)) return false;
    if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) return false;
    const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
    if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName)) return true;
    if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) return true;
    if (!nameIsPermitted) return _isBasicCustomElement(lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName, lcTag) || lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && _matchesNameCheck(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value);
    if (URI_SAFE_ATTRIBUTES[lcName]) return true;
    if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
    if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) return true;
    if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) return true;
    return !value;
  };
  const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, [
    "annotation-xml",
    "color-profile",
    "font-face",
    "font-face-format",
    "font-face-name",
    "font-face-src",
    "font-face-uri",
    "missing-glyph"
  ]);
  const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
    return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
  };
  const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute2(lcTag, lcName, namespaceURI, value) {
    if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) switch (trustedTypes.getAttributeType(lcTag, lcName)) {
      case "TrustedHTML":
        return _createTrustedHTML(value);
      case "TrustedScriptURL":
        return _createTrustedScriptURL(value);
    }
    return value;
  };
  const _setAttributeValue = function _setAttributeValue2(currentNode, name, namespaceURI, value) {
    try {
      if (namespaceURI) currentNode.setAttributeNS(namespaceURI, name, value);
      else currentNode.setAttribute(name, value);
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
        return false;
      }
      return true;
    } catch (_) {
      _removeAttribute(name, currentNode);
      return false;
    }
  };
  const _sanitizeAttributes = function _sanitizeAttributes2(currentNode, root) {
    _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
    if (_handleHookDetachedNode(currentNode, root)) return;
    const attributes = currentNode.attributes;
    if (!attributes || _isClobbered(currentNode)) return;
    ALLOWED_ATTR = _forkSharedAllowlist(hooks.uponSanitizeAttribute, ALLOWED_ATTR, DEFAULT_ALLOWED_ATTR, SET_CONFIG_ALLOWED_ATTR);
    const hookEvent = {
      attrName: "",
      attrValue: "",
      keepAttr: true,
      allowedAttributes: ALLOWED_ATTR,
      forceKeepAttr: void 0
    };
    let l = attributes.length;
    const lcTag = transformCaseFunc(currentNode.nodeName);
    while (l--) {
      const attr = attributes[l];
      const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
      const lcName = transformCaseFunc(name);
      const initValue = attrValue;
      let value = name === "value" ? initValue : stringTrim(initValue);
      let recreatedNamedProp = false;
      hookEvent.attrName = lcName;
      hookEvent.attrValue = value;
      hookEvent.keepAttr = true;
      hookEvent.forceKeepAttr = void 0;
      _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
      value = hookEvent.attrValue;
      if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
        _removeAttribute(name, currentNode, attr);
        value = SANITIZE_NAMED_PROPS_PREFIX + value;
        recreatedNamedProp = true;
      }
      if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (lcName === "attributename" && stringMatch(value, "href")) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (hookEvent.forceKeepAttr) continue;
      if (!hookEvent.keepAttr) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      if (SAFE_FOR_TEMPLATES) value = _stripTemplateExpressions(value);
      if (!_isValidAttribute(lcTag, lcName, value)) {
        _removeAttribute(name, currentNode, attr);
        continue;
      }
      value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
      if (value !== initValue) {
        if (_setAttributeValue(currentNode, name, namespaceURI, value) && recreatedNamedProp) arrayPop(DOMPurify.removed);
      }
    }
    _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
    _handleHookDetachedNode(currentNode, root);
  };
  const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
    let shadowNode = null;
    const shadowIterator = _createNodeIterator(fragment);
    _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
    while (shadowNode = shadowIterator.nextNode()) {
      _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
      _sanitizeElements(shadowNode, fragment);
      _sanitizeAttributes(shadowNode, fragment);
      if (_isDocumentFragment(shadowNode.content)) _sanitizeShadowDOM2(shadowNode.content);
      if (_readNodeType(shadowNode) === NODE_TYPE.element) {
        const innerSr = getShadowRoot(shadowNode);
        if (_isDocumentFragment(innerSr)) {
          _sanitizeAttachedShadowRoots(innerSr);
          _sanitizeShadowDOM2(innerSr);
        }
      }
    }
    _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
  };
  const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots2(root) {
    const stack = [{
      node: root,
      shadow: null
    }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item.shadow) {
        _sanitizeShadowDOM2(item.shadow);
        continue;
      }
      const node = item.node;
      const isElement = _readNodeType(node) === NODE_TYPE.element;
      const childNodes = getChildNodes(node);
      if (childNodes) for (let i = childNodes.length - 1; i >= 0; --i) stack.push({
        node: childNodes[i],
        shadow: null
      });
      if (isElement) {
        const rootName = getNodeName ? getNodeName(node) : null;
        if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
          const content = node.content;
          if (_isDocumentFragment(content)) stack.push({
            node: content,
            shadow: null
          });
        }
      }
      if (isElement) {
        const sr = getShadowRoot(node);
        if (_isDocumentFragment(sr)) stack.push({
          node: null,
          shadow: sr
        }, {
          node: sr,
          shadow: null
        });
      }
    }
  };
  DOMPurify.sanitize = function(dirty) {
    let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    let body = null;
    let importedNode = null;
    let currentNode = null;
    let returnNode = null;
    IS_EMPTY_INPUT = !dirty;
    if (IS_EMPTY_INPUT) dirty = "<!-->";
    if (typeof dirty !== "string" && !_isNode(dirty)) {
      dirty = stringifyValue(dirty);
      if (typeof dirty !== "string") throw typeErrorCreate("dirty is not a string, aborting");
    }
    if (!DOMPurify.isSupported) return dirty;
    if (SET_CONFIG) {
      ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
      ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
    } else _parseConfig(cfg);
    if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) ALLOWED_TAGS = clone(ALLOWED_TAGS);
    if (hooks.uponSanitizeAttribute.length > 0) ALLOWED_ATTR = clone(ALLOWED_ATTR);
    DOMPurify.removed = [];
    const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
    if (inPlace) {
      _neutralizePatchLinkage(dirty);
      const nn = _readNodeName(dirty);
      if (typeof nn === "string") {
        const tagName = transformCaseFunc(nn);
        if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
          _neutralizeRoot(dirty);
          throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
        }
      }
      if (_isClobbered(dirty)) {
        _neutralizeRoot(dirty);
        throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
      }
      try {
        _sanitizeAttachedShadowRoots(dirty);
      } catch (error) {
        _neutralizeRoot(dirty);
        throw error;
      }
    } else if (_isNode(dirty)) {
      body = _initDocument("<!---->");
      importedNode = body.ownerDocument.importNode(dirty, true);
      if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") body = importedNode;
      else if (importedNode.nodeName === "HTML") body = importedNode;
      else body.appendChild(importedNode);
      _sanitizeAttachedShadowRoots(body);
    } else {
      if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
      body = _initDocument(dirty);
      if (!body) return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
    }
    if (body && FORCE_BODY) _forceRemove(body.firstChild);
    const walkRoot = inPlace ? dirty : body;
    try {
      const nodeIterator = _createNodeIterator(walkRoot);
      while (currentNode = nodeIterator.nextNode()) {
        _sanitizeElements(currentNode, walkRoot);
        _sanitizeAttributes(currentNode, walkRoot);
        if (_isDocumentFragment(currentNode.content)) _sanitizeShadowDOM2(currentNode.content);
      }
    } catch (error) {
      if (inPlace) {
        _neutralizeRoot(dirty);
        arrayForEach(DOMPurify.removed, (entry) => {
          if (entry.element) _neutralizeSubtree(entry.element);
        });
      }
      throw error;
    }
    if (inPlace) {
      let rootWasRemoved = false;
      arrayForEach(DOMPurify.removed, (entry) => {
        if (entry.element) {
          if (entry.element === dirty) rootWasRemoved = true;
          _neutralizeSubtree(entry.element);
        }
      });
      if (rootWasRemoved) throw typeErrorCreate("a node selected for removal could not be safely returned; refusing to sanitize in place");
      if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(dirty);
      return dirty;
    }
    if (RETURN_DOM) {
      if (SAFE_FOR_TEMPLATES) _scrubTemplateExpressions2(body);
      if (RETURN_DOM_FRAGMENT) {
        returnNode = createDocumentFragment.call(body.ownerDocument);
        while (body.firstChild) returnNode.appendChild(body.firstChild);
      } else returnNode = body;
      if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) returnNode = importNode.call(originalDocument, returnNode, true);
      return returnNode;
    }
    let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
    if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
    if (SAFE_FOR_TEMPLATES) serializedHTML = _stripTemplateExpressions(serializedHTML);
    return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
  };
  DOMPurify.setConfig = function() {
    let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _parseConfig(cfg);
    SET_CONFIG = true;
    SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
    SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
  };
  DOMPurify.clearConfig = function() {
    CONFIG = null;
    SET_CONFIG = false;
    SET_CONFIG_ALLOWED_TAGS = null;
    SET_CONFIG_ALLOWED_ATTR = null;
    trustedTypesPolicy = defaultTrustedTypesPolicy;
    emptyHTML = "";
  };
  DOMPurify.isValidAttribute = function(tag2, attr, value) {
    if (!CONFIG) _parseConfig({});
    const lcTag = transformCaseFunc(tag2);
    const lcName = transformCaseFunc(attr);
    return _isValidAttribute(lcTag, lcName, value);
  };
  DOMPurify.addHook = function(entryPoint, hookFunction) {
    if (typeof hookFunction !== "function") return;
    if (!objectHasOwnProperty(hooks, entryPoint)) return;
    arrayPush(hooks[entryPoint], hookFunction);
  };
  DOMPurify.removeHook = function(entryPoint, hookFunction) {
    if (!objectHasOwnProperty(hooks, entryPoint)) return;
    if (hookFunction !== void 0) {
      const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
      return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
    }
    return arrayPop(hooks[entryPoint]);
  };
  DOMPurify.removeHooks = function(entryPoint) {
    if (!objectHasOwnProperty(hooks, entryPoint)) return;
    hooks[entryPoint] = [];
  };
  DOMPurify.removeAllHooks = function() {
    hooks = _createHooksMap();
  };
  return DOMPurify;
}
var purify_default = createDOMPurify();

// node_modules/marked/lib/marked.esm.js
function _getDefaults() {
  return {
    async: false,
    breaks: false,
    extensions: null,
    gfm: true,
    hooks: null,
    pedantic: false,
    renderer: null,
    silent: false,
    tokenizer: null,
    walkTokens: null
  };
}
var _defaults = _getDefaults();
function changeDefaults(newDefaults) {
  _defaults = newDefaults;
}
var noopTest = { exec: () => null };
function edit(regex, opt = "") {
  let source = typeof regex === "string" ? regex : regex.source;
  const obj = {
    replace: (name, val) => {
      let valSource = typeof val === "string" ? val : val.source;
      valSource = valSource.replace(other.caret, "$1");
      source = source.replace(name, valSource);
      return obj;
    },
    getRegex: () => {
      return new RegExp(source, opt);
    }
  };
  return obj;
}
var other = {
  codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  listReplaceTabs: /^\t+/,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\] /,
  listReplaceTask: /^\[[ xX]\] +/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  unescapeTest: /&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (bull) => new RegExp(`^( {0,3}${bull})((?:[	 ][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),
  hrRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),
  fencesBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}(?:\`\`\`|~~~)`),
  headingBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}#`),
  htmlBeginRegex: (indent) => new RegExp(`^ {0,${Math.min(3, indent - 1)}}<(?:[a-z].*>|!--)`, "i")
};
var newline = /^(?:[ \t]*(?:\n|$))+/;
var blockCode = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var fences = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var hr = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var heading = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var bullet = /(?:[*+-]|\d{1,9}[.)])/;
var lheadingCore = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var lheading = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var lheadingGfm = edit(lheadingCore).replace(/bull/g, bullet).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var _paragraph = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var blockText = /^[^\n]+/;
var _blockLabel = /(?!\s*\])(?:\\.|[^\[\]\\])+/;
var def = edit(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", _blockLabel).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var list = edit(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, bullet).getRegex();
var _tag = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var _comment = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var html2 = edit(
  "^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))",
  "i"
).replace("comment", _comment).replace("tag", _tag).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var paragraph = edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockquote = edit(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", paragraph).getRegex();
var blockNormal = {
  blockquote,
  code: blockCode,
  def,
  fences,
  heading,
  hr,
  html: html2,
  lheading,
  list,
  newline,
  paragraph,
  table: noopTest,
  text: blockText
};
var gfmTable = edit(
  "^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)"
).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex();
var blockGfm = {
  ...blockNormal,
  lheading: lheadingGfm,
  table: gfmTable,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", gfmTable).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)]) ").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", _tag).getRegex()
};
var blockPedantic = {
  ...blockNormal,
  html: edit(
    `^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`
  ).replace("comment", _comment).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,
  heading: /^(#{1,6})(.*)(?:\n+|$)/,
  fences: noopTest,
  // fences not supported
  lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,
  paragraph: edit(_paragraph).replace("hr", hr).replace("heading", " *#{1,6} *[^\n]").replace("lheading", lheading).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex()
};
var escape = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var inlineCode = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var br = /^( {2,}|\\)\n(?!\s*$)/;
var inlineText = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var _punctuation = /[\p{P}\p{S}]/u;
var _punctuationOrSpace = /[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpace = /[^\s\p{P}\p{S}]/u;
var punctuation = edit(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, _punctuationOrSpace).getRegex();
var _punctuationGfmStrongEm = /(?!~)[\p{P}\p{S}]/u;
var _punctuationOrSpaceGfmStrongEm = /(?!~)[\s\p{P}\p{S}]/u;
var _notPunctuationOrSpaceGfmStrongEm = /(?:[^\s\p{P}\p{S}]|~)/u;
var blockSkip = /\[[^[\]]*?\]\((?:\\.|[^\\\(\)]|\((?:\\.|[^\\\(\)])*\))*\)|`[^`]*?`|<[^<>]*?>/g;
var emStrongLDelimCore = /^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/;
var emStrongLDelim = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuation).getRegex();
var emStrongLDelimGfm = edit(emStrongLDelimCore, "u").replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimAstCore = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var emStrongRDelimAst = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var emStrongRDelimAstGfm = edit(emStrongRDelimAstCore, "gu").replace(/notPunctSpace/g, _notPunctuationOrSpaceGfmStrongEm).replace(/punctSpace/g, _punctuationOrSpaceGfmStrongEm).replace(/punct/g, _punctuationGfmStrongEm).getRegex();
var emStrongRDelimUnd = edit(
  "^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)",
  "gu"
).replace(/notPunctSpace/g, _notPunctuationOrSpace).replace(/punctSpace/g, _punctuationOrSpace).replace(/punct/g, _punctuation).getRegex();
var anyPunctuation = edit(/\\(punct)/, "gu").replace(/punct/g, _punctuation).getRegex();
var autolink = edit(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var _inlineComment = edit(_comment).replace("(?:-->|$)", "-->").getRegex();
var tag = edit(
  "^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>"
).replace("comment", _inlineComment).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var _inlineLabel = /(?:\[(?:\\.|[^\[\]\\])*\]|\\.|`[^`]*`|[^\[\]\\`])*?/;
var link = edit(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label", _inlineLabel).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var reflink = edit(/^!?\[(label)\]\[(ref)\]/).replace("label", _inlineLabel).replace("ref", _blockLabel).getRegex();
var nolink = edit(/^!?\[(ref)\](?:\[\])?/).replace("ref", _blockLabel).getRegex();
var reflinkSearch = edit("reflink|nolink(?!\\()", "g").replace("reflink", reflink).replace("nolink", nolink).getRegex();
var inlineNormal = {
  _backpedal: noopTest,
  // only used for GFM url
  anyPunctuation,
  autolink,
  blockSkip,
  br,
  code: inlineCode,
  del: noopTest,
  emStrongLDelim,
  emStrongRDelimAst,
  emStrongRDelimUnd,
  escape,
  link,
  nolink,
  punctuation,
  reflink,
  reflinkSearch,
  tag,
  text: inlineText,
  url: noopTest
};
var inlinePedantic = {
  ...inlineNormal,
  link: edit(/^!?\[(label)\]\((.*?)\)/).replace("label", _inlineLabel).getRegex(),
  reflink: edit(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", _inlineLabel).getRegex()
};
var inlineGfm = {
  ...inlineNormal,
  emStrongRDelimAst: emStrongRDelimAstGfm,
  emStrongLDelim: emStrongLDelimGfm,
  url: edit(/^((?:ftp|https?):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/, "i").replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),
  _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,
  del: /^(~~?)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/,
  text: /^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|https?:\/\/|ftp:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/
};
var inlineBreaks = {
  ...inlineGfm,
  br: edit(br).replace("{2,}", "*").getRegex(),
  text: edit(inlineGfm.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex()
};
var block = {
  normal: blockNormal,
  gfm: blockGfm,
  pedantic: blockPedantic
};
var inline = {
  normal: inlineNormal,
  gfm: inlineGfm,
  breaks: inlineBreaks,
  pedantic: inlinePedantic
};
var escapeReplacements = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var getEscapeReplacement = (ch) => escapeReplacements[ch];
function escape2(html22, encode) {
  if (encode) {
    if (other.escapeTest.test(html22)) {
      return html22.replace(other.escapeReplace, getEscapeReplacement);
    }
  } else {
    if (other.escapeTestNoEncode.test(html22)) {
      return html22.replace(other.escapeReplaceNoEncode, getEscapeReplacement);
    }
  }
  return html22;
}
function cleanUrl(href) {
  try {
    href = encodeURI(href).replace(other.percentDecode, "%");
  } catch {
    return null;
  }
  return href;
}
function splitCells(tableRow, count) {
  const row = tableRow.replace(other.findPipe, (match, offset, str) => {
    let escaped = false;
    let curr = offset;
    while (--curr >= 0 && str[curr] === "\\") escaped = !escaped;
    if (escaped) {
      return "|";
    } else {
      return " |";
    }
  }), cells = row.split(other.splitPipe);
  let i = 0;
  if (!cells[0].trim()) {
    cells.shift();
  }
  if (cells.length > 0 && !cells.at(-1)?.trim()) {
    cells.pop();
  }
  if (count) {
    if (cells.length > count) {
      cells.splice(count);
    } else {
      while (cells.length < count) cells.push("");
    }
  }
  for (; i < cells.length; i++) {
    cells[i] = cells[i].trim().replace(other.slashPipe, "|");
  }
  return cells;
}
function rtrim(str, c, invert) {
  const l = str.length;
  if (l === 0) {
    return "";
  }
  let suffLen = 0;
  while (suffLen < l) {
    const currChar = str.charAt(l - suffLen - 1);
    if (currChar === c && !invert) {
      suffLen++;
    } else if (currChar !== c && invert) {
      suffLen++;
    } else {
      break;
    }
  }
  return str.slice(0, l - suffLen);
}
function findClosingBracket(str, b) {
  if (str.indexOf(b[1]) === -1) {
    return -1;
  }
  let level = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === "\\") {
      i++;
    } else if (str[i] === b[0]) {
      level++;
    } else if (str[i] === b[1]) {
      level--;
      if (level < 0) {
        return i;
      }
    }
  }
  if (level > 0) {
    return -2;
  }
  return -1;
}
function outputLink(cap, link2, raw, lexer2, rules2) {
  const href = link2.href;
  const title = link2.title || null;
  const text2 = cap[1].replace(rules2.other.outputLinkReplace, "$1");
  lexer2.state.inLink = true;
  const token = {
    type: cap[0].charAt(0) === "!" ? "image" : "link",
    raw,
    href,
    title,
    text: text2,
    tokens: lexer2.inlineTokens(text2)
  };
  lexer2.state.inLink = false;
  return token;
}
function indentCodeCompensation(raw, text2, rules2) {
  const matchIndentToCode = raw.match(rules2.other.indentCodeCompensation);
  if (matchIndentToCode === null) {
    return text2;
  }
  const indentToCode = matchIndentToCode[1];
  return text2.split("\n").map((node) => {
    const matchIndentInNode = node.match(rules2.other.beginningSpace);
    if (matchIndentInNode === null) {
      return node;
    }
    const [indentInNode] = matchIndentInNode;
    if (indentInNode.length >= indentToCode.length) {
      return node.slice(indentToCode.length);
    }
    return node;
  }).join("\n");
}
var _Tokenizer = class {
  options;
  rules;
  // set by the lexer
  lexer;
  // set by the lexer
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(src) {
    const cap = this.rules.block.newline.exec(src);
    if (cap && cap[0].length > 0) {
      return {
        type: "space",
        raw: cap[0]
      };
    }
  }
  code(src) {
    const cap = this.rules.block.code.exec(src);
    if (cap) {
      const text2 = cap[0].replace(this.rules.other.codeRemoveIndent, "");
      return {
        type: "code",
        raw: cap[0],
        codeBlockStyle: "indented",
        text: !this.options.pedantic ? rtrim(text2, "\n") : text2
      };
    }
  }
  fences(src) {
    const cap = this.rules.block.fences.exec(src);
    if (cap) {
      const raw = cap[0];
      const text2 = indentCodeCompensation(raw, cap[3] || "", this.rules);
      return {
        type: "code",
        raw,
        lang: cap[2] ? cap[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : cap[2],
        text: text2
      };
    }
  }
  heading(src) {
    const cap = this.rules.block.heading.exec(src);
    if (cap) {
      let text2 = cap[2].trim();
      if (this.rules.other.endingHash.test(text2)) {
        const trimmed = rtrim(text2, "#");
        if (this.options.pedantic) {
          text2 = trimmed.trim();
        } else if (!trimmed || this.rules.other.endingSpaceChar.test(trimmed)) {
          text2 = trimmed.trim();
        }
      }
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[1].length,
        text: text2,
        tokens: this.lexer.inline(text2)
      };
    }
  }
  hr(src) {
    const cap = this.rules.block.hr.exec(src);
    if (cap) {
      return {
        type: "hr",
        raw: rtrim(cap[0], "\n")
      };
    }
  }
  blockquote(src) {
    const cap = this.rules.block.blockquote.exec(src);
    if (cap) {
      let lines = rtrim(cap[0], "\n").split("\n");
      let raw = "";
      let text2 = "";
      const tokens = [];
      while (lines.length > 0) {
        let inBlockquote = false;
        const currentLines = [];
        let i;
        for (i = 0; i < lines.length; i++) {
          if (this.rules.other.blockquoteStart.test(lines[i])) {
            currentLines.push(lines[i]);
            inBlockquote = true;
          } else if (!inBlockquote) {
            currentLines.push(lines[i]);
          } else {
            break;
          }
        }
        lines = lines.slice(i);
        const currentRaw = currentLines.join("\n");
        const currentText = currentRaw.replace(this.rules.other.blockquoteSetextReplace, "\n    $1").replace(this.rules.other.blockquoteSetextReplace2, "");
        raw = raw ? `${raw}
${currentRaw}` : currentRaw;
        text2 = text2 ? `${text2}
${currentText}` : currentText;
        const top = this.lexer.state.top;
        this.lexer.state.top = true;
        this.lexer.blockTokens(currentText, tokens, true);
        this.lexer.state.top = top;
        if (lines.length === 0) {
          break;
        }
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "code") {
          break;
        } else if (lastToken?.type === "blockquote") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.blockquote(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - oldToken.raw.length) + newToken.raw;
          text2 = text2.substring(0, text2.length - oldToken.text.length) + newToken.text;
          break;
        } else if (lastToken?.type === "list") {
          const oldToken = lastToken;
          const newText = oldToken.raw + "\n" + lines.join("\n");
          const newToken = this.list(newText);
          tokens[tokens.length - 1] = newToken;
          raw = raw.substring(0, raw.length - lastToken.raw.length) + newToken.raw;
          text2 = text2.substring(0, text2.length - oldToken.raw.length) + newToken.raw;
          lines = newText.substring(tokens.at(-1).raw.length).split("\n");
          continue;
        }
      }
      return {
        type: "blockquote",
        raw,
        tokens,
        text: text2
      };
    }
  }
  list(src) {
    let cap = this.rules.block.list.exec(src);
    if (cap) {
      let bull = cap[1].trim();
      const isordered = bull.length > 1;
      const list2 = {
        type: "list",
        raw: "",
        ordered: isordered,
        start: isordered ? +bull.slice(0, -1) : "",
        loose: false,
        items: []
      };
      bull = isordered ? `\\d{1,9}\\${bull.slice(-1)}` : `\\${bull}`;
      if (this.options.pedantic) {
        bull = isordered ? bull : "[*+-]";
      }
      const itemRegex = this.rules.other.listItemRegex(bull);
      let endsWithBlankLine = false;
      while (src) {
        let endEarly = false;
        let raw = "";
        let itemContents = "";
        if (!(cap = itemRegex.exec(src))) {
          break;
        }
        if (this.rules.block.hr.test(src)) {
          break;
        }
        raw = cap[0];
        src = src.substring(raw.length);
        let line = cap[2].split("\n", 1)[0].replace(this.rules.other.listReplaceTabs, (t) => " ".repeat(3 * t.length));
        let nextLine = src.split("\n", 1)[0];
        let blankLine = !line.trim();
        let indent = 0;
        if (this.options.pedantic) {
          indent = 2;
          itemContents = line.trimStart();
        } else if (blankLine) {
          indent = cap[1].length + 1;
        } else {
          indent = cap[2].search(this.rules.other.nonSpaceChar);
          indent = indent > 4 ? 1 : indent;
          itemContents = line.slice(indent);
          indent += cap[1].length;
        }
        if (blankLine && this.rules.other.blankLine.test(nextLine)) {
          raw += nextLine + "\n";
          src = src.substring(nextLine.length + 1);
          endEarly = true;
        }
        if (!endEarly) {
          const nextBulletRegex = this.rules.other.nextBulletRegex(indent);
          const hrRegex = this.rules.other.hrRegex(indent);
          const fencesBeginRegex = this.rules.other.fencesBeginRegex(indent);
          const headingBeginRegex = this.rules.other.headingBeginRegex(indent);
          const htmlBeginRegex = this.rules.other.htmlBeginRegex(indent);
          while (src) {
            const rawLine = src.split("\n", 1)[0];
            let nextLineWithoutTabs;
            nextLine = rawLine;
            if (this.options.pedantic) {
              nextLine = nextLine.replace(this.rules.other.listReplaceNesting, "  ");
              nextLineWithoutTabs = nextLine;
            } else {
              nextLineWithoutTabs = nextLine.replace(this.rules.other.tabCharGlobal, "    ");
            }
            if (fencesBeginRegex.test(nextLine)) {
              break;
            }
            if (headingBeginRegex.test(nextLine)) {
              break;
            }
            if (htmlBeginRegex.test(nextLine)) {
              break;
            }
            if (nextBulletRegex.test(nextLine)) {
              break;
            }
            if (hrRegex.test(nextLine)) {
              break;
            }
            if (nextLineWithoutTabs.search(this.rules.other.nonSpaceChar) >= indent || !nextLine.trim()) {
              itemContents += "\n" + nextLineWithoutTabs.slice(indent);
            } else {
              if (blankLine) {
                break;
              }
              if (line.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4) {
                break;
              }
              if (fencesBeginRegex.test(line)) {
                break;
              }
              if (headingBeginRegex.test(line)) {
                break;
              }
              if (hrRegex.test(line)) {
                break;
              }
              itemContents += "\n" + nextLine;
            }
            if (!blankLine && !nextLine.trim()) {
              blankLine = true;
            }
            raw += rawLine + "\n";
            src = src.substring(rawLine.length + 1);
            line = nextLineWithoutTabs.slice(indent);
          }
        }
        if (!list2.loose) {
          if (endsWithBlankLine) {
            list2.loose = true;
          } else if (this.rules.other.doubleBlankLine.test(raw)) {
            endsWithBlankLine = true;
          }
        }
        let istask = null;
        let ischecked;
        if (this.options.gfm) {
          istask = this.rules.other.listIsTask.exec(itemContents);
          if (istask) {
            ischecked = istask[0] !== "[ ] ";
            itemContents = itemContents.replace(this.rules.other.listReplaceTask, "");
          }
        }
        list2.items.push({
          type: "list_item",
          raw,
          task: !!istask,
          checked: ischecked,
          loose: false,
          text: itemContents,
          tokens: []
        });
        list2.raw += raw;
      }
      const lastItem = list2.items.at(-1);
      if (lastItem) {
        lastItem.raw = lastItem.raw.trimEnd();
        lastItem.text = lastItem.text.trimEnd();
      } else {
        return;
      }
      list2.raw = list2.raw.trimEnd();
      for (let i = 0; i < list2.items.length; i++) {
        this.lexer.state.top = false;
        list2.items[i].tokens = this.lexer.blockTokens(list2.items[i].text, []);
        if (!list2.loose) {
          const spacers = list2.items[i].tokens.filter((t) => t.type === "space");
          const hasMultipleLineBreaks = spacers.length > 0 && spacers.some((t) => this.rules.other.anyLine.test(t.raw));
          list2.loose = hasMultipleLineBreaks;
        }
      }
      if (list2.loose) {
        for (let i = 0; i < list2.items.length; i++) {
          list2.items[i].loose = true;
        }
      }
      return list2;
    }
  }
  html(src) {
    const cap = this.rules.block.html.exec(src);
    if (cap) {
      const token = {
        type: "html",
        block: true,
        raw: cap[0],
        pre: cap[1] === "pre" || cap[1] === "script" || cap[1] === "style",
        text: cap[0]
      };
      return token;
    }
  }
  def(src) {
    const cap = this.rules.block.def.exec(src);
    if (cap) {
      const tag2 = cap[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " ");
      const href = cap[2] ? cap[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "";
      const title = cap[3] ? cap[3].substring(1, cap[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : cap[3];
      return {
        type: "def",
        tag: tag2,
        raw: cap[0],
        href,
        title
      };
    }
  }
  table(src) {
    const cap = this.rules.block.table.exec(src);
    if (!cap) {
      return;
    }
    if (!this.rules.other.tableDelimiter.test(cap[2])) {
      return;
    }
    const headers = splitCells(cap[1]);
    const aligns = cap[2].replace(this.rules.other.tableAlignChars, "").split("|");
    const rows = cap[3]?.trim() ? cap[3].replace(this.rules.other.tableRowBlankLine, "").split("\n") : [];
    const item = {
      type: "table",
      raw: cap[0],
      header: [],
      align: [],
      rows: []
    };
    if (headers.length !== aligns.length) {
      return;
    }
    for (const align of aligns) {
      if (this.rules.other.tableAlignRight.test(align)) {
        item.align.push("right");
      } else if (this.rules.other.tableAlignCenter.test(align)) {
        item.align.push("center");
      } else if (this.rules.other.tableAlignLeft.test(align)) {
        item.align.push("left");
      } else {
        item.align.push(null);
      }
    }
    for (let i = 0; i < headers.length; i++) {
      item.header.push({
        text: headers[i],
        tokens: this.lexer.inline(headers[i]),
        header: true,
        align: item.align[i]
      });
    }
    for (const row of rows) {
      item.rows.push(splitCells(row, item.header.length).map((cell, i) => {
        return {
          text: cell,
          tokens: this.lexer.inline(cell),
          header: false,
          align: item.align[i]
        };
      }));
    }
    return item;
  }
  lheading(src) {
    const cap = this.rules.block.lheading.exec(src);
    if (cap) {
      return {
        type: "heading",
        raw: cap[0],
        depth: cap[2].charAt(0) === "=" ? 1 : 2,
        text: cap[1],
        tokens: this.lexer.inline(cap[1])
      };
    }
  }
  paragraph(src) {
    const cap = this.rules.block.paragraph.exec(src);
    if (cap) {
      const text2 = cap[1].charAt(cap[1].length - 1) === "\n" ? cap[1].slice(0, -1) : cap[1];
      return {
        type: "paragraph",
        raw: cap[0],
        text: text2,
        tokens: this.lexer.inline(text2)
      };
    }
  }
  text(src) {
    const cap = this.rules.block.text.exec(src);
    if (cap) {
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        tokens: this.lexer.inline(cap[0])
      };
    }
  }
  escape(src) {
    const cap = this.rules.inline.escape.exec(src);
    if (cap) {
      return {
        type: "escape",
        raw: cap[0],
        text: cap[1]
      };
    }
  }
  tag(src) {
    const cap = this.rules.inline.tag.exec(src);
    if (cap) {
      if (!this.lexer.state.inLink && this.rules.other.startATag.test(cap[0])) {
        this.lexer.state.inLink = true;
      } else if (this.lexer.state.inLink && this.rules.other.endATag.test(cap[0])) {
        this.lexer.state.inLink = false;
      }
      if (!this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = true;
      } else if (this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(cap[0])) {
        this.lexer.state.inRawBlock = false;
      }
      return {
        type: "html",
        raw: cap[0],
        inLink: this.lexer.state.inLink,
        inRawBlock: this.lexer.state.inRawBlock,
        block: false,
        text: cap[0]
      };
    }
  }
  link(src) {
    const cap = this.rules.inline.link.exec(src);
    if (cap) {
      const trimmedUrl = cap[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(trimmedUrl)) {
        if (!this.rules.other.endAngleBracket.test(trimmedUrl)) {
          return;
        }
        const rtrimSlash = rtrim(trimmedUrl.slice(0, -1), "\\");
        if ((trimmedUrl.length - rtrimSlash.length) % 2 === 0) {
          return;
        }
      } else {
        const lastParenIndex = findClosingBracket(cap[2], "()");
        if (lastParenIndex === -2) {
          return;
        }
        if (lastParenIndex > -1) {
          const start = cap[0].indexOf("!") === 0 ? 5 : 4;
          const linkLen = start + cap[1].length + lastParenIndex;
          cap[2] = cap[2].substring(0, lastParenIndex);
          cap[0] = cap[0].substring(0, linkLen).trim();
          cap[3] = "";
        }
      }
      let href = cap[2];
      let title = "";
      if (this.options.pedantic) {
        const link2 = this.rules.other.pedanticHrefTitle.exec(href);
        if (link2) {
          href = link2[1];
          title = link2[3];
        }
      } else {
        title = cap[3] ? cap[3].slice(1, -1) : "";
      }
      href = href.trim();
      if (this.rules.other.startAngleBracket.test(href)) {
        if (this.options.pedantic && !this.rules.other.endAngleBracket.test(trimmedUrl)) {
          href = href.slice(1);
        } else {
          href = href.slice(1, -1);
        }
      }
      return outputLink(cap, {
        href: href ? href.replace(this.rules.inline.anyPunctuation, "$1") : href,
        title: title ? title.replace(this.rules.inline.anyPunctuation, "$1") : title
      }, cap[0], this.lexer, this.rules);
    }
  }
  reflink(src, links) {
    let cap;
    if ((cap = this.rules.inline.reflink.exec(src)) || (cap = this.rules.inline.nolink.exec(src))) {
      const linkString = (cap[2] || cap[1]).replace(this.rules.other.multipleSpaceGlobal, " ");
      const link2 = links[linkString.toLowerCase()];
      if (!link2) {
        const text2 = cap[0].charAt(0);
        return {
          type: "text",
          raw: text2,
          text: text2
        };
      }
      return outputLink(cap, link2, cap[0], this.lexer, this.rules);
    }
  }
  emStrong(src, maskedSrc, prevChar = "") {
    let match = this.rules.inline.emStrongLDelim.exec(src);
    if (!match) return;
    if (match[3] && prevChar.match(this.rules.other.unicodeAlphaNumeric)) return;
    const nextChar = match[1] || match[2] || "";
    if (!nextChar || !prevChar || this.rules.inline.punctuation.exec(prevChar)) {
      const lLength = [...match[0]].length - 1;
      let rDelim, rLength, delimTotal = lLength, midDelimTotal = 0;
      const endReg = match[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      endReg.lastIndex = 0;
      maskedSrc = maskedSrc.slice(-1 * src.length + lLength);
      while ((match = endReg.exec(maskedSrc)) != null) {
        rDelim = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];
        if (!rDelim) continue;
        rLength = [...rDelim].length;
        if (match[3] || match[4]) {
          delimTotal += rLength;
          continue;
        } else if (match[5] || match[6]) {
          if (lLength % 3 && !((lLength + rLength) % 3)) {
            midDelimTotal += rLength;
            continue;
          }
        }
        delimTotal -= rLength;
        if (delimTotal > 0) continue;
        rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);
        const lastCharLength = [...match[0]][0].length;
        const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);
        if (Math.min(lLength, rLength) % 2) {
          const text22 = raw.slice(1, -1);
          return {
            type: "em",
            raw,
            text: text22,
            tokens: this.lexer.inlineTokens(text22)
          };
        }
        const text2 = raw.slice(2, -2);
        return {
          type: "strong",
          raw,
          text: text2,
          tokens: this.lexer.inlineTokens(text2)
        };
      }
    }
  }
  codespan(src) {
    const cap = this.rules.inline.code.exec(src);
    if (cap) {
      let text2 = cap[2].replace(this.rules.other.newLineCharGlobal, " ");
      const hasNonSpaceChars = this.rules.other.nonSpaceChar.test(text2);
      const hasSpaceCharsOnBothEnds = this.rules.other.startingSpaceChar.test(text2) && this.rules.other.endingSpaceChar.test(text2);
      if (hasNonSpaceChars && hasSpaceCharsOnBothEnds) {
        text2 = text2.substring(1, text2.length - 1);
      }
      return {
        type: "codespan",
        raw: cap[0],
        text: text2
      };
    }
  }
  br(src) {
    const cap = this.rules.inline.br.exec(src);
    if (cap) {
      return {
        type: "br",
        raw: cap[0]
      };
    }
  }
  del(src) {
    const cap = this.rules.inline.del.exec(src);
    if (cap) {
      return {
        type: "del",
        raw: cap[0],
        text: cap[2],
        tokens: this.lexer.inlineTokens(cap[2])
      };
    }
  }
  autolink(src) {
    const cap = this.rules.inline.autolink.exec(src);
    if (cap) {
      let text2, href;
      if (cap[2] === "@") {
        text2 = cap[1];
        href = "mailto:" + text2;
      } else {
        text2 = cap[1];
        href = text2;
      }
      return {
        type: "link",
        raw: cap[0],
        text: text2,
        href,
        tokens: [
          {
            type: "text",
            raw: text2,
            text: text2
          }
        ]
      };
    }
  }
  url(src) {
    let cap;
    if (cap = this.rules.inline.url.exec(src)) {
      let text2, href;
      if (cap[2] === "@") {
        text2 = cap[0];
        href = "mailto:" + text2;
      } else {
        let prevCapZero;
        do {
          prevCapZero = cap[0];
          cap[0] = this.rules.inline._backpedal.exec(cap[0])?.[0] ?? "";
        } while (prevCapZero !== cap[0]);
        text2 = cap[0];
        if (cap[1] === "www.") {
          href = "http://" + cap[0];
        } else {
          href = cap[0];
        }
      }
      return {
        type: "link",
        raw: cap[0],
        text: text2,
        href,
        tokens: [
          {
            type: "text",
            raw: text2,
            text: text2
          }
        ]
      };
    }
  }
  inlineText(src) {
    const cap = this.rules.inline.text.exec(src);
    if (cap) {
      const escaped = this.lexer.state.inRawBlock;
      return {
        type: "text",
        raw: cap[0],
        text: cap[0],
        escaped
      };
    }
  }
};
var _Lexer = class __Lexer {
  tokens;
  options;
  state;
  tokenizer;
  inlineQueue;
  constructor(options2) {
    this.tokens = [];
    this.tokens.links = /* @__PURE__ */ Object.create(null);
    this.options = options2 || _defaults;
    this.options.tokenizer = this.options.tokenizer || new _Tokenizer();
    this.tokenizer = this.options.tokenizer;
    this.tokenizer.options = this.options;
    this.tokenizer.lexer = this;
    this.inlineQueue = [];
    this.state = {
      inLink: false,
      inRawBlock: false,
      top: true
    };
    const rules2 = {
      other,
      block: block.normal,
      inline: inline.normal
    };
    if (this.options.pedantic) {
      rules2.block = block.pedantic;
      rules2.inline = inline.pedantic;
    } else if (this.options.gfm) {
      rules2.block = block.gfm;
      if (this.options.breaks) {
        rules2.inline = inline.breaks;
      } else {
        rules2.inline = inline.gfm;
      }
    }
    this.tokenizer.rules = rules2;
  }
  /**
   * Expose Rules
   */
  static get rules() {
    return {
      block,
      inline
    };
  }
  /**
   * Static Lex Method
   */
  static lex(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.lex(src);
  }
  /**
   * Static Lex Inline Method
   */
  static lexInline(src, options2) {
    const lexer2 = new __Lexer(options2);
    return lexer2.inlineTokens(src);
  }
  /**
   * Preprocessing
   */
  lex(src) {
    src = src.replace(other.carriageReturn, "\n");
    this.blockTokens(src, this.tokens);
    for (let i = 0; i < this.inlineQueue.length; i++) {
      const next = this.inlineQueue[i];
      this.inlineTokens(next.src, next.tokens);
    }
    this.inlineQueue = [];
    return this.tokens;
  }
  blockTokens(src, tokens = [], lastParagraphClipped = false) {
    if (this.options.pedantic) {
      src = src.replace(other.tabCharGlobal, "    ").replace(other.spaceLine, "");
    }
    while (src) {
      let token;
      if (this.options.extensions?.block?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.space(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.raw.length === 1 && lastToken !== void 0) {
          lastToken.raw += "\n";
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.code(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.fences(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.heading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.hr(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.blockquote(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.list(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.html(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.def(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "paragraph" || lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.raw;
          this.inlineQueue.at(-1).src = lastToken.text;
        } else if (!this.tokens.links[token.tag]) {
          this.tokens.links[token.tag] = {
            href: token.href,
            title: token.title
          };
        }
        continue;
      }
      if (token = this.tokenizer.table(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.lheading(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startBlock) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startBlock.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (this.state.top && (token = this.tokenizer.paragraph(cutSrc))) {
        const lastToken = tokens.at(-1);
        if (lastParagraphClipped && lastToken?.type === "paragraph") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        lastParagraphClipped = cutSrc.length !== src.length;
        src = src.substring(token.raw.length);
        continue;
      }
      if (token = this.tokenizer.text(src)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += "\n" + token.raw;
          lastToken.text += "\n" + token.text;
          this.inlineQueue.pop();
          this.inlineQueue.at(-1).src = lastToken.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    this.state.top = true;
    return tokens;
  }
  inline(src, tokens = []) {
    this.inlineQueue.push({ src, tokens });
    return tokens;
  }
  /**
   * Lexing/Compiling
   */
  inlineTokens(src, tokens = []) {
    let maskedSrc = src;
    let match = null;
    if (this.tokens.links) {
      const links = Object.keys(this.tokens.links);
      if (links.length > 0) {
        while ((match = this.tokenizer.rules.inline.reflinkSearch.exec(maskedSrc)) != null) {
          if (links.includes(match[0].slice(match[0].lastIndexOf("[") + 1, -1))) {
            maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex);
          }
        }
      }
    }
    while ((match = this.tokenizer.rules.inline.anyPunctuation.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "++" + maskedSrc.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    }
    while ((match = this.tokenizer.rules.inline.blockSkip.exec(maskedSrc)) != null) {
      maskedSrc = maskedSrc.slice(0, match.index) + "[" + "a".repeat(match[0].length - 2) + "]" + maskedSrc.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    }
    let keepPrevChar = false;
    let prevChar = "";
    while (src) {
      if (!keepPrevChar) {
        prevChar = "";
      }
      keepPrevChar = false;
      let token;
      if (this.options.extensions?.inline?.some((extTokenizer) => {
        if (token = extTokenizer.call({ lexer: this }, src, tokens)) {
          src = src.substring(token.raw.length);
          tokens.push(token);
          return true;
        }
        return false;
      })) {
        continue;
      }
      if (token = this.tokenizer.escape(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.tag(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.link(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.reflink(src, this.tokens.links)) {
        src = src.substring(token.raw.length);
        const lastToken = tokens.at(-1);
        if (token.type === "text" && lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (token = this.tokenizer.emStrong(src, maskedSrc, prevChar)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.codespan(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.br(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.del(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (token = this.tokenizer.autolink(src)) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      if (!this.state.inLink && (token = this.tokenizer.url(src))) {
        src = src.substring(token.raw.length);
        tokens.push(token);
        continue;
      }
      let cutSrc = src;
      if (this.options.extensions?.startInline) {
        let startIndex = Infinity;
        const tempSrc = src.slice(1);
        let tempStart;
        this.options.extensions.startInline.forEach((getStartIndex) => {
          tempStart = getStartIndex.call({ lexer: this }, tempSrc);
          if (typeof tempStart === "number" && tempStart >= 0) {
            startIndex = Math.min(startIndex, tempStart);
          }
        });
        if (startIndex < Infinity && startIndex >= 0) {
          cutSrc = src.substring(0, startIndex + 1);
        }
      }
      if (token = this.tokenizer.inlineText(cutSrc)) {
        src = src.substring(token.raw.length);
        if (token.raw.slice(-1) !== "_") {
          prevChar = token.raw.slice(-1);
        }
        keepPrevChar = true;
        const lastToken = tokens.at(-1);
        if (lastToken?.type === "text") {
          lastToken.raw += token.raw;
          lastToken.text += token.text;
        } else {
          tokens.push(token);
        }
        continue;
      }
      if (src) {
        const errMsg = "Infinite loop on byte: " + src.charCodeAt(0);
        if (this.options.silent) {
          console.error(errMsg);
          break;
        } else {
          throw new Error(errMsg);
        }
      }
    }
    return tokens;
  }
};
var _Renderer = class {
  options;
  parser;
  // set by the parser
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  space(token) {
    return "";
  }
  code({ text: text2, lang, escaped }) {
    const langString = (lang || "").match(other.notSpaceStart)?.[0];
    const code = text2.replace(other.endingNewline, "") + "\n";
    if (!langString) {
      return "<pre><code>" + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
    }
    return '<pre><code class="language-' + escape2(langString) + '">' + (escaped ? code : escape2(code, true)) + "</code></pre>\n";
  }
  blockquote({ tokens }) {
    const body = this.parser.parse(tokens);
    return `<blockquote>
${body}</blockquote>
`;
  }
  html({ text: text2 }) {
    return text2;
  }
  heading({ tokens, depth }) {
    return `<h${depth}>${this.parser.parseInline(tokens)}</h${depth}>
`;
  }
  hr(token) {
    return "<hr>\n";
  }
  list(token) {
    const ordered = token.ordered;
    const start = token.start;
    let body = "";
    for (let j = 0; j < token.items.length; j++) {
      const item = token.items[j];
      body += this.listitem(item);
    }
    const type = ordered ? "ol" : "ul";
    const startAttr = ordered && start !== 1 ? ' start="' + start + '"' : "";
    return "<" + type + startAttr + ">\n" + body + "</" + type + ">\n";
  }
  listitem(item) {
    let itemBody = "";
    if (item.task) {
      const checkbox = this.checkbox({ checked: !!item.checked });
      if (item.loose) {
        if (item.tokens[0]?.type === "paragraph") {
          item.tokens[0].text = checkbox + " " + item.tokens[0].text;
          if (item.tokens[0].tokens && item.tokens[0].tokens.length > 0 && item.tokens[0].tokens[0].type === "text") {
            item.tokens[0].tokens[0].text = checkbox + " " + escape2(item.tokens[0].tokens[0].text);
            item.tokens[0].tokens[0].escaped = true;
          }
        } else {
          item.tokens.unshift({
            type: "text",
            raw: checkbox + " ",
            text: checkbox + " ",
            escaped: true
          });
        }
      } else {
        itemBody += checkbox + " ";
      }
    }
    itemBody += this.parser.parse(item.tokens, !!item.loose);
    return `<li>${itemBody}</li>
`;
  }
  checkbox({ checked }) {
    return "<input " + (checked ? 'checked="" ' : "") + 'disabled="" type="checkbox">';
  }
  paragraph({ tokens }) {
    return `<p>${this.parser.parseInline(tokens)}</p>
`;
  }
  table(token) {
    let header = "";
    let cell = "";
    for (let j = 0; j < token.header.length; j++) {
      cell += this.tablecell(token.header[j]);
    }
    header += this.tablerow({ text: cell });
    let body = "";
    for (let j = 0; j < token.rows.length; j++) {
      const row = token.rows[j];
      cell = "";
      for (let k = 0; k < row.length; k++) {
        cell += this.tablecell(row[k]);
      }
      body += this.tablerow({ text: cell });
    }
    if (body) body = `<tbody>${body}</tbody>`;
    return "<table>\n<thead>\n" + header + "</thead>\n" + body + "</table>\n";
  }
  tablerow({ text: text2 }) {
    return `<tr>
${text2}</tr>
`;
  }
  tablecell(token) {
    const content = this.parser.parseInline(token.tokens);
    const type = token.header ? "th" : "td";
    const tag2 = token.align ? `<${type} align="${token.align}">` : `<${type}>`;
    return tag2 + content + `</${type}>
`;
  }
  /**
   * span level renderer
   */
  strong({ tokens }) {
    return `<strong>${this.parser.parseInline(tokens)}</strong>`;
  }
  em({ tokens }) {
    return `<em>${this.parser.parseInline(tokens)}</em>`;
  }
  codespan({ text: text2 }) {
    return `<code>${escape2(text2, true)}</code>`;
  }
  br(token) {
    return "<br>";
  }
  del({ tokens }) {
    return `<del>${this.parser.parseInline(tokens)}</del>`;
  }
  link({ href, title, tokens }) {
    const text2 = this.parser.parseInline(tokens);
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return text2;
    }
    href = cleanHref;
    let out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + escape2(title) + '"';
    }
    out += ">" + text2 + "</a>";
    return out;
  }
  image({ href, title, text: text2, tokens }) {
    if (tokens) {
      text2 = this.parser.parseInline(tokens, this.parser.textRenderer);
    }
    const cleanHref = cleanUrl(href);
    if (cleanHref === null) {
      return escape2(text2);
    }
    href = cleanHref;
    let out = `<img src="${href}" alt="${text2}"`;
    if (title) {
      out += ` title="${escape2(title)}"`;
    }
    out += ">";
    return out;
  }
  text(token) {
    return "tokens" in token && token.tokens ? this.parser.parseInline(token.tokens) : "escaped" in token && token.escaped ? token.text : escape2(token.text);
  }
};
var _TextRenderer = class {
  // no need for block level renderers
  strong({ text: text2 }) {
    return text2;
  }
  em({ text: text2 }) {
    return text2;
  }
  codespan({ text: text2 }) {
    return text2;
  }
  del({ text: text2 }) {
    return text2;
  }
  html({ text: text2 }) {
    return text2;
  }
  text({ text: text2 }) {
    return text2;
  }
  link({ text: text2 }) {
    return "" + text2;
  }
  image({ text: text2 }) {
    return "" + text2;
  }
  br() {
    return "";
  }
};
var _Parser = class __Parser {
  options;
  renderer;
  textRenderer;
  constructor(options2) {
    this.options = options2 || _defaults;
    this.options.renderer = this.options.renderer || new _Renderer();
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
    this.renderer.parser = this;
    this.textRenderer = new _TextRenderer();
  }
  /**
   * Static Parse Method
   */
  static parse(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parse(tokens);
  }
  /**
   * Static Parse Inline Method
   */
  static parseInline(tokens, options2) {
    const parser2 = new __Parser(options2);
    return parser2.parseInline(tokens);
  }
  /**
   * Parse Loop
   */
  parse(tokens, top = true) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const genericToken = anyToken;
        const ret = this.options.extensions.renderers[genericToken.type].call({ parser: this }, genericToken);
        if (ret !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "paragraph", "text"].includes(genericToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "space": {
          out += this.renderer.space(token);
          continue;
        }
        case "hr": {
          out += this.renderer.hr(token);
          continue;
        }
        case "heading": {
          out += this.renderer.heading(token);
          continue;
        }
        case "code": {
          out += this.renderer.code(token);
          continue;
        }
        case "table": {
          out += this.renderer.table(token);
          continue;
        }
        case "blockquote": {
          out += this.renderer.blockquote(token);
          continue;
        }
        case "list": {
          out += this.renderer.list(token);
          continue;
        }
        case "html": {
          out += this.renderer.html(token);
          continue;
        }
        case "paragraph": {
          out += this.renderer.paragraph(token);
          continue;
        }
        case "text": {
          let textToken = token;
          let body = this.renderer.text(textToken);
          while (i + 1 < tokens.length && tokens[i + 1].type === "text") {
            textToken = tokens[++i];
            body += "\n" + this.renderer.text(textToken);
          }
          if (top) {
            out += this.renderer.paragraph({
              type: "paragraph",
              raw: body,
              text: body,
              tokens: [{ type: "text", raw: body, text: body, escaped: true }]
            });
          } else {
            out += body;
          }
          continue;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
  /**
   * Parse Inline Tokens
   */
  parseInline(tokens, renderer = this.renderer) {
    let out = "";
    for (let i = 0; i < tokens.length; i++) {
      const anyToken = tokens[i];
      if (this.options.extensions?.renderers?.[anyToken.type]) {
        const ret = this.options.extensions.renderers[anyToken.type].call({ parser: this }, anyToken);
        if (ret !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(anyToken.type)) {
          out += ret || "";
          continue;
        }
      }
      const token = anyToken;
      switch (token.type) {
        case "escape": {
          out += renderer.text(token);
          break;
        }
        case "html": {
          out += renderer.html(token);
          break;
        }
        case "link": {
          out += renderer.link(token);
          break;
        }
        case "image": {
          out += renderer.image(token);
          break;
        }
        case "strong": {
          out += renderer.strong(token);
          break;
        }
        case "em": {
          out += renderer.em(token);
          break;
        }
        case "codespan": {
          out += renderer.codespan(token);
          break;
        }
        case "br": {
          out += renderer.br(token);
          break;
        }
        case "del": {
          out += renderer.del(token);
          break;
        }
        case "text": {
          out += renderer.text(token);
          break;
        }
        default: {
          const errMsg = 'Token with "' + token.type + '" type was not found.';
          if (this.options.silent) {
            console.error(errMsg);
            return "";
          } else {
            throw new Error(errMsg);
          }
        }
      }
    }
    return out;
  }
};
var _Hooks = class {
  options;
  block;
  constructor(options2) {
    this.options = options2 || _defaults;
  }
  static passThroughHooks = /* @__PURE__ */ new Set([
    "preprocess",
    "postprocess",
    "processAllTokens"
  ]);
  /**
   * Process markdown before marked
   */
  preprocess(markdown) {
    return markdown;
  }
  /**
   * Process HTML after marked is finished
   */
  postprocess(html22) {
    return html22;
  }
  /**
   * Process all tokens before walk tokens
   */
  processAllTokens(tokens) {
    return tokens;
  }
  /**
   * Provide function to tokenize markdown
   */
  provideLexer() {
    return this.block ? _Lexer.lex : _Lexer.lexInline;
  }
  /**
   * Provide function to parse tokens
   */
  provideParser() {
    return this.block ? _Parser.parse : _Parser.parseInline;
  }
};
var Marked = class {
  defaults = _getDefaults();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = _Parser;
  Renderer = _Renderer;
  TextRenderer = _TextRenderer;
  Lexer = _Lexer;
  Tokenizer = _Tokenizer;
  Hooks = _Hooks;
  constructor(...args) {
    this.use(...args);
  }
  /**
   * Run callback for every token
   */
  walkTokens(tokens, callback) {
    let values = [];
    for (const token of tokens) {
      values = values.concat(callback.call(this, token));
      switch (token.type) {
        case "table": {
          const tableToken = token;
          for (const cell of tableToken.header) {
            values = values.concat(this.walkTokens(cell.tokens, callback));
          }
          for (const row of tableToken.rows) {
            for (const cell of row) {
              values = values.concat(this.walkTokens(cell.tokens, callback));
            }
          }
          break;
        }
        case "list": {
          const listToken = token;
          values = values.concat(this.walkTokens(listToken.items, callback));
          break;
        }
        default: {
          const genericToken = token;
          if (this.defaults.extensions?.childTokens?.[genericToken.type]) {
            this.defaults.extensions.childTokens[genericToken.type].forEach((childTokens) => {
              const tokens2 = genericToken[childTokens].flat(Infinity);
              values = values.concat(this.walkTokens(tokens2, callback));
            });
          } else if (genericToken.tokens) {
            values = values.concat(this.walkTokens(genericToken.tokens, callback));
          }
        }
      }
    }
    return values;
  }
  use(...args) {
    const extensions = this.defaults.extensions || { renderers: {}, childTokens: {} };
    args.forEach((pack) => {
      const opts = { ...pack };
      opts.async = this.defaults.async || opts.async || false;
      if (pack.extensions) {
        pack.extensions.forEach((ext) => {
          if (!ext.name) {
            throw new Error("extension name required");
          }
          if ("renderer" in ext) {
            const prevRenderer = extensions.renderers[ext.name];
            if (prevRenderer) {
              extensions.renderers[ext.name] = function(...args2) {
                let ret = ext.renderer.apply(this, args2);
                if (ret === false) {
                  ret = prevRenderer.apply(this, args2);
                }
                return ret;
              };
            } else {
              extensions.renderers[ext.name] = ext.renderer;
            }
          }
          if ("tokenizer" in ext) {
            if (!ext.level || ext.level !== "block" && ext.level !== "inline") {
              throw new Error("extension level must be 'block' or 'inline'");
            }
            const extLevel = extensions[ext.level];
            if (extLevel) {
              extLevel.unshift(ext.tokenizer);
            } else {
              extensions[ext.level] = [ext.tokenizer];
            }
            if (ext.start) {
              if (ext.level === "block") {
                if (extensions.startBlock) {
                  extensions.startBlock.push(ext.start);
                } else {
                  extensions.startBlock = [ext.start];
                }
              } else if (ext.level === "inline") {
                if (extensions.startInline) {
                  extensions.startInline.push(ext.start);
                } else {
                  extensions.startInline = [ext.start];
                }
              }
            }
          }
          if ("childTokens" in ext && ext.childTokens) {
            extensions.childTokens[ext.name] = ext.childTokens;
          }
        });
        opts.extensions = extensions;
      }
      if (pack.renderer) {
        const renderer = this.defaults.renderer || new _Renderer(this.defaults);
        for (const prop in pack.renderer) {
          if (!(prop in renderer)) {
            throw new Error(`renderer '${prop}' does not exist`);
          }
          if (["options", "parser"].includes(prop)) {
            continue;
          }
          const rendererProp = prop;
          const rendererFunc = pack.renderer[rendererProp];
          const prevRenderer = renderer[rendererProp];
          renderer[rendererProp] = (...args2) => {
            let ret = rendererFunc.apply(renderer, args2);
            if (ret === false) {
              ret = prevRenderer.apply(renderer, args2);
            }
            return ret || "";
          };
        }
        opts.renderer = renderer;
      }
      if (pack.tokenizer) {
        const tokenizer = this.defaults.tokenizer || new _Tokenizer(this.defaults);
        for (const prop in pack.tokenizer) {
          if (!(prop in tokenizer)) {
            throw new Error(`tokenizer '${prop}' does not exist`);
          }
          if (["options", "rules", "lexer"].includes(prop)) {
            continue;
          }
          const tokenizerProp = prop;
          const tokenizerFunc = pack.tokenizer[tokenizerProp];
          const prevTokenizer = tokenizer[tokenizerProp];
          tokenizer[tokenizerProp] = (...args2) => {
            let ret = tokenizerFunc.apply(tokenizer, args2);
            if (ret === false) {
              ret = prevTokenizer.apply(tokenizer, args2);
            }
            return ret;
          };
        }
        opts.tokenizer = tokenizer;
      }
      if (pack.hooks) {
        const hooks = this.defaults.hooks || new _Hooks();
        for (const prop in pack.hooks) {
          if (!(prop in hooks)) {
            throw new Error(`hook '${prop}' does not exist`);
          }
          if (["options", "block"].includes(prop)) {
            continue;
          }
          const hooksProp = prop;
          const hooksFunc = pack.hooks[hooksProp];
          const prevHook = hooks[hooksProp];
          if (_Hooks.passThroughHooks.has(prop)) {
            hooks[hooksProp] = (arg) => {
              if (this.defaults.async) {
                return Promise.resolve(hooksFunc.call(hooks, arg)).then((ret2) => {
                  return prevHook.call(hooks, ret2);
                });
              }
              const ret = hooksFunc.call(hooks, arg);
              return prevHook.call(hooks, ret);
            };
          } else {
            hooks[hooksProp] = (...args2) => {
              let ret = hooksFunc.apply(hooks, args2);
              if (ret === false) {
                ret = prevHook.apply(hooks, args2);
              }
              return ret;
            };
          }
        }
        opts.hooks = hooks;
      }
      if (pack.walkTokens) {
        const walkTokens2 = this.defaults.walkTokens;
        const packWalktokens = pack.walkTokens;
        opts.walkTokens = function(token) {
          let values = [];
          values.push(packWalktokens.call(this, token));
          if (walkTokens2) {
            values = values.concat(walkTokens2.call(this, token));
          }
          return values;
        };
      }
      this.defaults = { ...this.defaults, ...opts };
    });
    return this;
  }
  setOptions(opt) {
    this.defaults = { ...this.defaults, ...opt };
    return this;
  }
  lexer(src, options2) {
    return _Lexer.lex(src, options2 ?? this.defaults);
  }
  parser(tokens, options2) {
    return _Parser.parse(tokens, options2 ?? this.defaults);
  }
  parseMarkdown(blockType) {
    const parse2 = (src, options2) => {
      const origOpt = { ...options2 };
      const opt = { ...this.defaults, ...origOpt };
      const throwError = this.onError(!!opt.silent, !!opt.async);
      if (this.defaults.async === true && origOpt.async === false) {
        return throwError(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      }
      if (typeof src === "undefined" || src === null) {
        return throwError(new Error("marked(): input parameter is undefined or null"));
      }
      if (typeof src !== "string") {
        return throwError(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(src) + ", string expected"));
      }
      if (opt.hooks) {
        opt.hooks.options = opt;
        opt.hooks.block = blockType;
      }
      const lexer2 = opt.hooks ? opt.hooks.provideLexer() : blockType ? _Lexer.lex : _Lexer.lexInline;
      const parser2 = opt.hooks ? opt.hooks.provideParser() : blockType ? _Parser.parse : _Parser.parseInline;
      if (opt.async) {
        return Promise.resolve(opt.hooks ? opt.hooks.preprocess(src) : src).then((src2) => lexer2(src2, opt)).then((tokens) => opt.hooks ? opt.hooks.processAllTokens(tokens) : tokens).then((tokens) => opt.walkTokens ? Promise.all(this.walkTokens(tokens, opt.walkTokens)).then(() => tokens) : tokens).then((tokens) => parser2(tokens, opt)).then((html22) => opt.hooks ? opt.hooks.postprocess(html22) : html22).catch(throwError);
      }
      try {
        if (opt.hooks) {
          src = opt.hooks.preprocess(src);
        }
        let tokens = lexer2(src, opt);
        if (opt.hooks) {
          tokens = opt.hooks.processAllTokens(tokens);
        }
        if (opt.walkTokens) {
          this.walkTokens(tokens, opt.walkTokens);
        }
        let html22 = parser2(tokens, opt);
        if (opt.hooks) {
          html22 = opt.hooks.postprocess(html22);
        }
        return html22;
      } catch (e) {
        return throwError(e);
      }
    };
    return parse2;
  }
  onError(silent, async) {
    return (e) => {
      e.message += "\nPlease report this to https://github.com/markedjs/marked.";
      if (silent) {
        const msg = "<p>An error occurred:</p><pre>" + escape2(e.message + "", true) + "</pre>";
        if (async) {
          return Promise.resolve(msg);
        }
        return msg;
      }
      if (async) {
        return Promise.reject(e);
      }
      throw e;
    };
  }
};
var markedInstance = new Marked();
function marked(src, opt) {
  return markedInstance.parse(src, opt);
}
marked.options = marked.setOptions = function(options2) {
  markedInstance.setOptions(options2);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.getDefaults = _getDefaults;
marked.defaults = _defaults;
marked.use = function(...args) {
  markedInstance.use(...args);
  marked.defaults = markedInstance.defaults;
  changeDefaults(marked.defaults);
  return marked;
};
marked.walkTokens = function(tokens, callback) {
  return markedInstance.walkTokens(tokens, callback);
};
marked.parseInline = markedInstance.parseInline;
marked.Parser = _Parser;
marked.parser = _Parser.parse;
marked.Renderer = _Renderer;
marked.TextRenderer = _TextRenderer;
marked.Lexer = _Lexer;
marked.lexer = _Lexer.lex;
marked.Tokenizer = _Tokenizer;
marked.Hooks = _Hooks;
marked.parse = marked;
var options = marked.options;
var setOptions = marked.setOptions;
var use = marked.use;
var walkTokens = marked.walkTokens;
var parseInline = marked.parseInline;
var parser = _Parser.parse;
var lexer = _Lexer.lex;

// src/shared/providers.ts
var PROVIDERS = [
  {
    id: "doubao",
    label: "\u8C46\u5305",
    enabled: true,
    homeUrl: "https://www.doubao.com/chat",
    urlPatterns: ["https://www.doubao.com/chat*"],
    colorClass: "provider-doubao",
    capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    enabled: true,
    homeUrl: "https://chat.deepseek.com/",
    urlPatterns: ["https://chat.deepseek.com/*"],
    colorClass: "provider-deepseek",
    capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: "kimi",
    label: "Kimi",
    enabled: true,
    homeUrl: "https://www.kimi.com/",
    urlPatterns: ["https://www.kimi.com/*"],
    colorClass: "provider-kimi",
    capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: "qwen",
    label: "\u5343\u95EE",
    enabled: true,
    homeUrl: "https://www.qianwen.com/",
    urlPatterns: ["https://www.qianwen.com/*"],
    colorClass: "provider-qwen",
    capabilities: { text: true, images: false, attachments: false, cancel: true }
  },
  {
    id: "zhipu",
    label: "\u667A\u8C31\u6E05\u8A00",
    enabled: true,
    homeUrl: "https://chatglm.cn/main/alltoolsdetail?lang=zh",
    urlPatterns: ["https://chatglm.cn/*"],
    colorClass: "provider-zhipu",
    capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: "gpt",
    label: "GPT",
    enabled: true,
    homeUrl: "https://chatgpt.com/",
    urlPatterns: ["https://chatgpt.com/*"],
    colorClass: "provider-gpt",
    capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: "gemini",
    label: "Gemini",
    enabled: true,
    homeUrl: "https://gemini.google.com/app",
    urlPatterns: ["https://gemini.google.com/*"],
    colorClass: "provider-gemini",
    capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: "grok",
    label: "Grok",
    enabled: true,
    homeUrl: "https://grok.com/",
    urlPatterns: ["https://grok.com/*"],
    colorClass: "provider-grok",
    capabilities: { text: true, images: true, attachments: true, cancel: true }
  },
  {
    id: "wenxin",
    label: "\u6587\u5FC3",
    enabled: true,
    homeUrl: "https://wenxin.baidu.com/",
    urlPatterns: ["https://wenxin.baidu.com/*"],
    colorClass: "provider-wenxin",
    iconFile: "wenxin.png",
    capabilities: { text: true, images: false, attachments: false, cancel: true }
  },
  {
    id: "minimax",
    label: "MiniMax",
    enabled: true,
    homeUrl: "https://agent.minimax.cn/",
    urlPatterns: ["https://agent.minimax.cn/*"],
    colorClass: "provider-minimax",
    iconFile: "minimax.png",
    capabilities: { text: true, images: false, attachments: false, cancel: true }
  }
];
var providerById = Object.fromEntries(PROVIDERS.map((provider) => [provider.id, provider]));

// src/shared/storage.ts
var STORAGE_KEY = "multiAiRoundtableStateV2";
var LEGACY_STORAGE_KEY = "multiAiRoundtableStateV1";
var DEFAULT_STATE = {
  activeMode: "qa",
  settings: {
    replyAcceleration: true,
    qaProviders: ["doubao", "deepseek"],
    roundtableProviders: ["doubao", "deepseek"],
    werewolfProviders: ["doubao", "deepseek", "kimi", "qwen", "zhipu", "gpt", "gemini", "grok"],
    fogCouncilProviders: ["doubao", "deepseek", "kimi", "qwen", "zhipu", "gpt", "gemini", "grok"],
    expertPresetByProvider: {}
  },
  expertPresets: [],
  conversations: [],
  activeConversationIds: {},
  werewolfGames: [],
  werewolfSetup: {
    playerCount: 6,
    providerIds: ["doubao", "deepseek", "kimi", "qwen", "zhipu", "gpt"],
    includeHuman: false,
    humanSeat: 0,
    presetId: "werewolf-v1-6"
  },
  fogCouncilGames: [],
  fogCouncilSetup: {
    playerCount: 6,
    providerIds: ["doubao", "deepseek", "kimi", "qwen", "zhipu", "gpt"],
    includeHuman: false,
    humanSeat: 0
  }
};
function createConversationSession(mode) {
  const now = Date.now();
  return {
    id: `session-${crypto.randomUUID()}`,
    mode,
    title: "\u65B0\u4F1A\u8BDD",
    createdAt: now,
    updatedAt: now,
    messages: [],
    bindings: {},
    needsFreshConversations: true,
    rounds: 2,
    expertInitializedProviders: []
  };
}
function legacySession(mode, messages, rounds = 2, bindings = {}, needsFresh = true) {
  const session = createConversationSession(mode);
  session.messages = messages;
  session.rounds = rounds;
  session.bindings = bindings;
  session.needsFreshConversations = needsFresh;
  session.title = messages.find((message) => message.role === "user")?.text.trim().slice(0, 32) || "\u65B0\u4F1A\u8BDD";
  return session;
}
function migrateLegacy(legacy) {
  const qa = legacySession("qa", legacy.qaMessages ?? [], 2, {}, !legacy.qaMessages?.length);
  const roundtable = legacySession(
    "roundtable",
    legacy.roundtableMessages ?? [],
    Math.max(1, Math.min(99, Number(legacy.roundtableRounds) || 2)),
    legacy.roundtableBindings ?? {},
    legacy.roundtableNeedsFreshConversations ?? !legacy.roundtableMessages?.length
  );
  const expert = createConversationSession("expert");
  return {
    activeMode: legacy.activeMode ?? "qa",
    settings: {
      replyAcceleration: true,
      qaProviders: legacy.settings?.qaProviders ?? DEFAULT_STATE.settings.qaProviders,
      roundtableProviders: legacy.settings?.roundtableProviders ?? DEFAULT_STATE.settings.roundtableProviders,
      werewolfProviders: DEFAULT_STATE.settings.werewolfProviders,
      fogCouncilProviders: DEFAULT_STATE.settings.fogCouncilProviders,
      expertPresetByProvider: {}
    },
    expertPresets: [],
    conversations: [qa, roundtable, expert],
    activeConversationIds: { qa: qa.id, roundtable: roundtable.id, expert: expert.id },
    werewolfGames: [],
    werewolfSetup: structuredClone(DEFAULT_STATE.werewolfSetup),
    fogCouncilGames: [],
    fogCouncilSetup: structuredClone(DEFAULT_STATE.fogCouncilSetup)
  };
}
async function loadState() {
  const result = await chrome.storage.local.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const stored = result[STORAGE_KEY];
  if (!stored) {
    const legacy = result[LEGACY_STORAGE_KEY];
    return legacy ? migrateLegacy(legacy) : structuredClone(DEFAULT_STATE);
  }
  const safeStored = { ...stored };
  for (const key of ["clocktowerGames", "activeClocktowerGameId", "clocktowerSetup"]) delete safeStored[key];
  const activeMode = ["qa", "roundtable", "expert", "werewolf", "fog_council"].includes(String(stored.activeMode)) ? stored.activeMode : "qa";
  return {
    ...DEFAULT_STATE,
    ...safeStored,
    activeMode,
    settings: {
      replyAcceleration: stored.settings?.replyAcceleration ?? true,
      qaProviders: stored.settings?.qaProviders ?? DEFAULT_STATE.settings.qaProviders,
      roundtableProviders: stored.settings?.roundtableProviders ?? DEFAULT_STATE.settings.roundtableProviders,
      werewolfProviders: stored.settings?.werewolfProviders ?? DEFAULT_STATE.settings.werewolfProviders,
      fogCouncilProviders: stored.settings?.fogCouncilProviders ?? DEFAULT_STATE.settings.fogCouncilProviders,
      expertPresetByProvider: stored.settings?.expertPresetByProvider ?? {}
    },
    expertPresets: stored.expertPresets ?? [],
    conversations: stored.conversations ?? [],
    activeConversationIds: stored.activeConversationIds ?? {},
    werewolfGames: stored.werewolfGames ?? [],
    activeWerewolfGameId: stored.activeWerewolfGameId,
    werewolfSetup: stored.werewolfSetup ?? structuredClone(DEFAULT_STATE.werewolfSetup),
    fogCouncilGames: stored.fogCouncilGames ?? [],
    activeFogCouncilGameId: stored.activeFogCouncilGameId,
    fogCouncilSetup: stored.fogCouncilSetup ?? structuredClone(DEFAULT_STATE.fogCouncilSetup)
  };
}

// src/sidepanel/expert-transfer.ts
function buildExpertPresetTransferFile(presets) {
  return {
    type: "multi-ai-roundtable-expert-presets",
    version: 1,
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    experts: presets.map(({ name, prompt }) => ({ name, prompt }))
  };
}
function parseExpertPresetTransferFile(text2) {
  let parsed;
  try {
    parsed = JSON.parse(text2);
  } catch {
    throw new Error("JSON \u6587\u4EF6\u683C\u5F0F\u65E0\u6548\u3002");
  }
  const rawExperts = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && Array.isArray(parsed.experts) ? parsed.experts : void 0;
  if (!rawExperts) throw new Error("JSON \u4E2D\u6CA1\u6709\u627E\u5230 experts \u4E13\u5BB6\u5217\u8868\u3002");
  if (rawExperts.length === 0) throw new Error("JSON \u4E2D\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u4E13\u5BB6\u3002");
  if (rawExperts.length > 500) throw new Error("\u5355\u6B21\u6700\u591A\u5BFC\u5165 500 \u4E2A\u4E13\u5BB6\u3002");
  const deduped = /* @__PURE__ */ new Map();
  rawExperts.forEach((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`\u7B2C ${index + 1} \u4E2A\u4E13\u5BB6\u683C\u5F0F\u65E0\u6548\u3002`);
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const prompt = typeof item.prompt === "string" ? item.prompt.trim() : "";
    if (!name || !prompt) throw new Error(`\u7B2C ${index + 1} \u4E2A\u4E13\u5BB6\u7F3A\u5C11\u540D\u79F0\u6216\u9884\u8BBE\u63D0\u793A\u8BCD\u3002`);
    if (name.length > 60) throw new Error(`\u7B2C ${index + 1} \u4E2A\u4E13\u5BB6\u540D\u79F0\u8D85\u8FC7 60 \u4E2A\u5B57\u7B26\u3002`);
    if (prompt.length > 5e5) throw new Error(`\u7B2C ${index + 1} \u4E2A\u4E13\u5BB6\u63D0\u793A\u8BCD\u8FC7\u957F\u3002`);
    deduped.set(name.toLocaleLowerCase(), { name, prompt });
  });
  return [...deduped.values()];
}
function mergeExpertPresets(existing, incoming, now, createId) {
  const presets = existing.map((preset) => ({ ...preset }));
  const byName = new Map(presets.map((preset, index) => [preset.name.trim().toLocaleLowerCase(), index]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const item of incoming) {
    const key = item.name.trim().toLocaleLowerCase();
    const index = byName.get(key);
    if (index === void 0) {
      presets.push({ id: createId(), name: item.name, prompt: item.prompt, createdAt: now, updatedAt: now });
      byName.set(key, presets.length - 1);
      added += 1;
      continue;
    }
    const current = presets[index];
    if (current.name === item.name && current.prompt === item.prompt) {
      unchanged += 1;
      continue;
    }
    presets[index] = { ...current, name: item.name, prompt: item.prompt, updatedAt: now };
    updated += 1;
  }
  return { presets, added, updated, unchanged };
}

// src/game/werewolf/rules.ts
var zeroRoles = () => ({ wolf: 0, villager: 0, seer: 0, witch: 0, hunter: 0 });
function rules(playerCount, roleCounts) {
  return {
    id: `werewolf-v1-${playerCount}`,
    name: `${playerCount} \u4EBA V1`,
    playerCount,
    roleCounts: { ...zeroRoles(), ...roleCounts },
    wolfDiscussionRounds: 2,
    wolfTiePolicy: "revote_then_seeded_random",
    dayVoteTiePolicy: "revote_then_no_exile",
    allowWitchSelfSaveFirstNight: true,
    allowDoublePotionSameNight: false,
    hunterCanShootWhenPoisoned: false,
    revealRoleOnDeath: false,
    wolvesMaySelfKill: true,
    nightDeathLastWords: false,
    dayExileLastWords: true,
    winCondition: "slaughter_edge"
  };
}
var WEREWOLF_RULESETS = [
  rules(6, { wolf: 2, seer: 1, witch: 1, villager: 2 }),
  rules(7, { wolf: 2, seer: 1, witch: 1, hunter: 1, villager: 2 }),
  rules(8, { wolf: 2, seer: 1, witch: 1, hunter: 1, villager: 3 })
];
var WEREWOLF_RULESET_BY_ID = Object.fromEntries(WEREWOLF_RULESETS.map((item) => [item.id, item]));
var ROLE_LABELS = {
  wolf: "\u72FC\u4EBA",
  villager: "\u6751\u6C11",
  seer: "\u9884\u8A00\u5BB6",
  witch: "\u5973\u5DEB",
  hunter: "\u730E\u4EBA"
};

// src/game/werewolf/core.ts
function playerBySeat(game, seat) {
  return game.players.find((player) => player.seat === seat);
}

// src/game/werewolf/context.ts
function canSeeVisibility(game, visibility, viewerSeat, revealAll = false) {
  if (revealAll || game.status === "ended") return true;
  if (visibility.type === "public") return true;
  if (visibility.type === "system") return false;
  if (viewerSeat === void 0) return false;
  const viewer = playerBySeat(game, viewerSeat);
  if (!viewer) return false;
  if (visibility.type === "private") return visibility.seat === viewerSeat;
  return visibility.type === "wolf" && viewer.role === "wolf";
}
function visibleEvents(game, viewerSeat, revealAll = false) {
  return game.events.filter((event) => canSeeVisibility(game, event.visibility, viewerSeat, revealAll));
}
function humanVisibleEvents(game) {
  const human = game.players.find((player) => player.controller === "human");
  return visibleEvents(game, human?.seat, game.status === "ended");
}

// src/game/fog-council/roles.ts
var COUNCIL_ROLES = [
  { id: "calibrator", name: "\u5B9A\u6807\u5E08", faction: "clarity", description: "\u6BCF\u8F6E\u6536\u5230\u552F\u4E00\u7684\u6B63\u786E\u9891\u9053\u4FE1\u53F7\u3002" },
  { id: "dual-track", name: "\u53CC\u8F68\u5E08", faction: "clarity", description: "\u6BCF\u8F6E\u6536\u5230\u542B\u6B63\u786E\u9891\u9053\u7684\u4E24\u4E2A\u5019\u9009\u3002" },
  { id: "filter", name: "\u6392\u8BEF\u5E08", faction: "clarity", description: "\u6BCF\u8F6E\u6536\u5230\u4E00\u4E2A\u786E\u5B9A\u9519\u8BEF\u7684\u9891\u9053\u3002" },
  { id: "wave-scout", name: "\u5DE1\u6CE2\u5E08", faction: "clarity", description: "\u6BCF\u8F6E\u6536\u5230\u4E00\u6761\u7EA6 75% \u53EF\u9760\u7684\u5355\u9891\u9053\u89C2\u6D4B\u3002" },
  { id: "coordinator", name: "\u534F\u8C03\u5E08", faction: "clarity", description: "\u5947\u6570\u8F6E\u83B7\u5F97\u53CC\u5019\u9009\uFF0C\u5076\u6570\u8F6E\u83B7\u5F97\u7CBE\u786E\u4FE1\u53F7\u3002" },
  { id: "line-keeper", name: "\u5B88\u7EBF\u5458", faction: "clarity", description: "\u6BCF\u8F6E\u83B7\u77E5\u6B63\u786E\u9891\u9053\u5C5E\u4E8E B \u8FD8\u662F A/C \u7EC4\u5408\u3002" },
  { id: "fog-weaver", name: "\u96FE\u7EC7\u8005", faction: "mist", description: "\u77E5\u6653\u6B63\u786E\u9891\u9053\uFF0C\u5C1D\u8BD5\u5728\u516C\u5F00\u8BA8\u8BBA\u4E2D\u8BEF\u5BFC\u8BAE\u4F1A\u3002" },
  { id: "noise-caster", name: "\u566A\u8BAF\u5E08", faction: "mist", description: "\u77E5\u6653\u6B63\u786E\u9891\u9053\uFF0C\u5C1D\u8BD5\u5728\u516C\u5F00\u8BA8\u8BBA\u4E2D\u8BEF\u5BFC\u8BAE\u4F1A\u3002" }
];
var COUNCIL_ROLE_BY_ID = Object.fromEntries(COUNCIL_ROLES.map((role) => [role.id, role]));

// src/game/fog-council/core.ts
function visibleCouncilEvents(game, viewerSeat) {
  return game.events.filter((e) => e.visibility.type === "public" || e.visibility.type === "seat" && e.visibility.seat === viewerSeat).map((e) => structuredClone(e));
}

// src/sidepanel/controller.ts
marked.use({ gfm: true, breaks: true });
var el = (id2) => document.getElementById(id2);
var messagesEl = el("messages");
var messageInput = el("messageInput");
var fileInput = el("fileInput");
var attachmentTray = el("attachmentTray");
var qaSendButton = el("qaSendButton");
var roundActionButton = el("roundActionButton");
var roundRange = el("roundRange");
var roundNumber = el("roundNumber");
var roundControls = el("roundControls");
var roundtableStatus = el("roundtableStatus");
var ICON_EDIT = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M7 42H43" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 26.7199V34H18.3172L39 13.3081L31.6951 6L11 26.7199Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>';
var ICON_DELETE = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M9 10V44H39V10H9Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M20 20V33M28 20V33" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 10H44" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 10L19.289 4H28.7771L32 10H16Z" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>';
var ICON_EXPORT = '<svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path d="M42 27C42 33 38 43 24 43C10 43 6 33 6 27" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24.0078 5.10059V33.0001" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 17L24 5L36 17" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
var state = structuredClone(DEFAULT_STATE);
var uiBaseline = structuredClone(DEFAULT_STATE);
var draftAttachments = [];
var interruptRequested = false;
var editingExpertId = null;
var providerAvailability = /* @__PURE__ */ new Map();
async function saveState(nextState) {
  const baseline = uiBaseline;
  const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
  const settings = {};
  for (const key of ["replyAcceleration", "qaProviders", "roundtableProviders", "werewolfProviders", "fogCouncilProviders", "expertPresetByProvider"]) {
    if (changed(nextState.settings[key], baseline.settings[key])) Object.assign(settings, { [key]: nextState.settings[key] });
  }
  const sessions = nextState.conversations.flatMap((session) => {
    const previous = baseline.conversations.find((item) => item.id === session.id);
    if (!previous) return [{ id: session.id, created: structuredClone(session) }];
    const addedMessages = session.messages.filter((message) => message.role === "user" && !previous.messages.some((item) => item.id === message.id));
    const update = {
      id: session.id,
      addedMessages,
      ...session.rounds !== previous.rounds ? { rounds: session.rounds } : {},
      ...session.title !== previous.title ? { title: session.title } : {},
      ...changed(session.expertAssignments, previous.expertAssignments) ? { expertAssignments: session.expertAssignments } : {}
    };
    return addedMessages.length || Object.keys(update).length > 2 ? [update] : [];
  });
  const patch = {
    ...nextState.activeMode !== baseline.activeMode ? { activeMode: nextState.activeMode } : {},
    ...changed(nextState.activeConversationIds, baseline.activeConversationIds) ? { activeConversationIds: nextState.activeConversationIds } : {},
    ...Object.keys(settings).length ? { settings } : {},
    ...changed(nextState.expertPresets, baseline.expertPresets) ? { expertPresets: nextState.expertPresets } : {},
    sessions,
    deletedSessionIds: baseline.conversations.filter((session) => !nextState.conversations.some((item) => item.id === session.id)).map((session) => session.id)
  };
  uiBaseline = structuredClone(nextState);
  try {
    await runtimeMessage({ type: "APPLY_UI_PATCH", patch });
  } catch (error) {
    await refreshStateFromStorage();
    throw error;
  }
}
function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
function isSequentialMode(mode) {
  return mode === "roundtable" || mode === "expert";
}
function isConversationMode(mode) {
  return mode !== "werewolf" && mode !== "fog_council";
}
function modeLabel(mode) {
  return mode === "qa" ? "AI \u5BF9\u8BDD" : mode === "roundtable" ? "AI \u5706\u684C" : mode === "expert" ? "\u4E13\u5BB6\u56E2" : mode === "werewolf" ? "\u72FC\u4EBA\u6740" : "\u8FF7\u96FE\u8BAE\u4F1A";
}
function providersForMode(mode) {
  if (mode === "qa") return state.settings.qaProviders;
  return state.settings.roundtableProviders;
}
function sessionById(sessionId) {
  return state.conversations.find((session) => session.id === sessionId);
}
function captureExpertAssignments() {
  const result = {};
  for (const provider of PROVIDERS) {
    const presetId = state.settings.expertPresetByProvider[provider.id];
    const preset = presetId ? state.expertPresets.find((item) => item.id === presetId) : void 0;
    if (preset) result[provider.id] = { presetId: preset.id, name: preset.name, prompt: preset.prompt };
  }
  return result;
}
function createSession(mode) {
  const session = createConversationSession(mode);
  if (mode === "expert") session.expertAssignments = captureExpertAssignments();
  state.conversations.push(session);
  state.activeConversationIds[mode] = session.id;
  return session;
}
function ensureActiveSession(mode) {
  const activeId = state.activeConversationIds[mode];
  const active = activeId ? sessionById(activeId) : void 0;
  if (active && active.mode === mode) return active;
  const latest = [...state.conversations].filter((session) => session.mode === mode).sort((a, b) => b.updatedAt - a.updatedAt)[0];
  if (latest) {
    state.activeConversationIds[mode] = latest.id;
    return latest;
  }
  return createSession(mode);
}
function activeSession() {
  if (!isConversationMode(state.activeMode)) throw new Error("\u6E38\u620F\u6A21\u5F0F\u4E0D\u4F7F\u7528\u666E\u901A\u4F1A\u8BDD Session");
  return ensureActiveSession(state.activeMode);
}
function activeWerewolfGame() {
  return state.activeWerewolfGameId ? state.werewolfGames.find((game) => game.id === state.activeWerewolfGameId) : void 0;
}
function activeFogCouncilGame() {
  return state.activeFogCouncilGameId ? state.fogCouncilGames.find((game) => game.id === state.activeFogCouncilGameId) : void 0;
}
function deriveTitle(payload) {
  const text2 = payload.text.replace(/\s+/g, " ").trim();
  if (text2) return text2.length > 30 ? `${text2.slice(0, 30)}\u2026` : text2;
  return payload.attachments[0]?.name || "\u65B0\u4F1A\u8BDD";
}
function touchSession(session) {
  session.updatedAt = Date.now();
}
function providerLabel(provider) {
  return provider ? providerById[provider].label : "\u7CFB\u7EDF";
}
function providerIconUrl(provider) {
  return chrome.runtime.getURL(`LOGO/${providerById[provider]?.iconFile ?? `${provider}.png`}`);
}
function providerDisplayLabel(session, provider) {
  if (!provider) return "\u7CFB\u7EDF";
  if (session.mode === "expert") {
    const expert = session.expertAssignments?.[provider];
    if (expert?.name) return `${providerLabel(provider)} \xB7 ${expert.name}`;
  }
  return providerLabel(provider);
}
function renderMarkdown(text2) {
  const rendered = marked.parse(text2 || "");
  return purify_default.sanitize(rendered, { USE_PROFILES: { html: true } });
}
function decorateRenderedMarkdown(container) {
  container.querySelectorAll("a").forEach((anchor) => {
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noreferrer noopener");
  });
  container.querySelectorAll("table").forEach((table) => {
    if (table.parentElement?.classList.contains("table-scroll")) return;
    const wrapper = document.createElement("div");
    wrapper.className = "table-scroll";
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}
function createReplyActions(text2) {
  const actions = document.createElement("div");
  actions.className = "reply-actions";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "reply-copy-button";
  copy.title = "\u590D\u5236\u56DE\u590D";
  copy.setAttribute("aria-label", "\u590D\u5236\u56DE\u590D");
  copy.innerHTML = '<svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M13 12.4316V7.8125C13 6.2592 14.2592 5 15.8125 5H40.1875C41.7408 5 43 6.2592 43 7.8125V32.1875C43 33.7408 41.7408 35 40.1875 35H35.5163" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32.1875 13H7.8125C6.2592 13 5 14.2592 5 15.8125V40.1875C5 41.7408 6.2592 43 7.8125 43H32.1875C33.7408 43 35 41.7408 35 40.1875V15.8125C35 14.2592 33.7408 13 32.1875 13Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/></svg>';
  copy.addEventListener("click", async () => {
    copy.disabled = true;
    try {
      await navigator.clipboard.writeText(text2);
      showComposerError("\u5DF2\u590D\u5236\u56DE\u590D");
    } catch {
      showComposerError("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u9009\u4E2D\u6587\u5B57\u624B\u52A8\u590D\u5236");
    } finally {
      copy.disabled = false;
    }
  });
  actions.append(copy);
  return actions;
}
function werewolfPhaseLabel(game) {
  const labels = {
    setup: "\u7B49\u5F85\u5F00\u59CB",
    night_start: `\u7B2C ${game.day} \u591C`,
    wolf_discussion: "\u72FC\u4EBA\u591C\u8C08",
    wolf_vote: "\u72FC\u4EBA\u5200\u4EBA\u6295\u7968",
    wolf_tiebreak_discussion: "\u72FC\u4EBA\u51B3\u80DC\u8BA8\u8BBA",
    wolf_tiebreak_vote: "\u72FC\u4EBA\u51B3\u80DC\u6295\u7968",
    seer_action: "\u9884\u8A00\u5BB6\u884C\u52A8",
    witch_action: "\u5973\u5DEB\u884C\u52A8",
    night_resolution: "\u591C\u95F4\u7ED3\u7B97",
    dawn: `\u7B2C ${game.day} \u5929\u5929\u4EAE`,
    death_trigger: "\u6B7B\u4EA1\u7ED3\u7B97",
    last_word: "\u9057\u8A00",
    day_speech: `\u7B2C ${game.day} \u5929\u53D1\u8A00`,
    day_vote: "\u767D\u5929\u6295\u7968",
    day_tiebreak_vote: "\u5E73\u7968\u91CD\u6295",
    exile_resolution: "\u653E\u9010\u7ED3\u7B97",
    win_check: "\u80DC\u8D1F\u68C0\u67E5",
    ended: "\u6E38\u620F\u7ED3\u675F"
  };
  return labels[game.phase] ?? game.phase;
}
function werewolfStatusLabel(game) {
  if (game.status === "paused") return game.lastError ? `\u5DF2\u4E2D\u65AD \xB7 ${game.lastError}` : "\u5DF2\u4E2D\u65AD\uFF0C\u53EF\u7EE7\u7EED";
  if (game.status === "error") return game.lastError ? `\u5F02\u5E38 \xB7 ${game.lastError}` : "\u5F02\u5E38\uFF0C\u7B49\u5F85\u5904\u7406";
  if (game.status === "waiting_human") return `\u7B49\u5F85\u4F60\u7684\u884C\u52A8 \xB7 ${werewolfPhaseLabel(game)}`;
  if (game.status === "ended") return `${game.winner === "wolf" ? "\u72FC\u4EBA\u9635\u8425" : "\u597D\u4EBA\u9635\u8425"}\u83B7\u80DC`;
  if (game.status === "running") return werewolfPhaseLabel(game);
  return "\u5F85\u5F00\u59CB";
}
function werewolfProgressLabel(game) {
  const pending = game.pendingTurn ?? game.pendingParallelTurns?.[0];
  const kindLabels = {
    wolf_discussion: "\u72FC\u4EBA\u8BA8\u8BBA\u4E2D\u2026",
    kill: "\u72FC\u4EBA\u5200\u4EBA\u4E2D\u2026",
    check: "\u9884\u8A00\u5BB6\u9A8C\u4EBA\u4E2D\u2026",
    witch: "\u5973\u5DEB\u51B3\u5B9A\u4E2D\u2026",
    shoot: "\u730E\u4EBA\u884C\u52A8\u4E2D\u2026",
    speech: "\u767D\u5929\u53D1\u8A00\u4E2D\u2026",
    vote: "\u6295\u7968\u5904\u7406\u4E2D\u2026",
    last_word: "\u9057\u8A00\u8FDB\u884C\u4E2D\u2026"
  };
  if (pending?.kind && kindLabels[pending.kind]) return kindLabels[pending.kind];
  const phaseLabels = {
    wolf_discussion: "\u72FC\u4EBA\u8BA8\u8BBA\u4E2D\u2026",
    wolf_vote: "\u72FC\u4EBA\u5200\u4EBA\u4E2D\u2026",
    wolf_tiebreak_discussion: "\u72FC\u4EBA\u8BA8\u8BBA\u4E2D\u2026",
    wolf_tiebreak_vote: "\u72FC\u4EBA\u5200\u4EBA\u4E2D\u2026",
    seer_action: "\u9884\u8A00\u5BB6\u9A8C\u4EBA\u4E2D\u2026",
    witch_action: "\u5973\u5DEB\u51B3\u5B9A\u4E2D\u2026",
    night_start: "\u591C\u95F4\u51C6\u5907\u4E2D\u2026",
    night_resolution: "\u591C\u95F4\u7ED3\u7B97\u4E2D\u2026",
    death_trigger: "\u6B7B\u4EA1\u7ED3\u7B97\u4E2D\u2026",
    last_word: "\u9057\u8A00\u8FDB\u884C\u4E2D\u2026",
    day_speech: "\u767D\u5929\u53D1\u8A00\u4E2D\u2026",
    day_vote: "\u6295\u7968\u5904\u7406\u4E2D\u2026",
    day_tiebreak_vote: "\u6295\u7968\u5904\u7406\u4E2D\u2026",
    exile_resolution: "\u653E\u9010\u7ED3\u7B97\u4E2D\u2026",
    win_check: "\u80DC\u8D1F\u68C0\u67E5\u4E2D\u2026"
  };
  return phaseLabels[game.phase] ?? "\u6E38\u620F\u5904\u7406\u4E2D\u2026";
}
function werewolfHumanPlayer(game) {
  return game.players.find((player) => player.controller === "human");
}
function werewolfPhaseLabelForHuman(game) {
  const human = werewolfHumanPlayer(game);
  if (game.phase.startsWith("wolf_")) return human?.role === "wolf" ? werewolfPhaseLabel(game) : `\u7B2C ${game.day} \u591C \xB7 \u591C\u95F4\u884C\u52A8`;
  if (game.phase === "seer_action") return human?.role === "seer" ? werewolfPhaseLabel(game) : `\u7B2C ${game.day} \u591C \xB7 \u591C\u95F4\u884C\u52A8`;
  if (game.phase === "witch_action") return human?.role === "witch" ? werewolfPhaseLabel(game) : `\u7B2C ${game.day} \u591C \xB7 \u591C\u95F4\u884C\u52A8`;
  return werewolfPhaseLabel(game);
}
function canRevealPendingWerewolfActor(game) {
  const pending = game.pendingTurn;
  if (!pending) return false;
  if (pending.kind === "speech" || pending.kind === "last_word") return true;
  return pending.kind === "wolf_discussion" && werewolfHumanPlayer(game)?.role === "wolf";
}
function humanTextTurn(pending) {
  return Boolean(pending && ["speech", "wolf_discussion", "last_word"].includes(pending.kind));
}
function actionLabel(action) {
  const labels = {
    vote: "\u6295\u7968",
    kill: "\u5200\u4EBA",
    check: "\u67E5\u9A8C",
    save: "\u4F7F\u7528\u89E3\u836F",
    poison: "\u4F7F\u7528\u6BD2\u836F",
    shoot: "\u5F00\u67AA",
    pass: "\u8DF3\u8FC7",
    speech: "\u53D1\u8A00"
  };
  return labels[action];
}
async function submitWerewolfHumanAction(submission) {
  const game = activeWerewolfGame();
  if (!game?.pendingHumanAction) return;
  try {
    await runtimeMessage({ type: "SUBMIT_WEREWOLF_HUMAN_ACTION", gameId: game.id, submission });
    clearComposer();
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}
function renderHumanActionPanel(game, pending, dashboard) {
  if (humanTextTurn(pending)) return;
  const panel = document.createElement("div");
  panel.className = "werewolf-human-actions";
  const intro = document.createElement("div");
  intro.style.width = "100%";
  intro.style.fontSize = "11px";
  intro.style.color = "var(--muted)";
  intro.textContent = pending.kind === "vote" ? "\u8BF7\u9009\u62E9\u6295\u7968\u76EE\u6807\u3002\u6240\u6709\u5B58\u6D3B\u73A9\u5BB6\u540C\u65F6\u63D0\u4EA4\uFF0C\u5168\u90E8\u5B8C\u6210\u540E\u7EDF\u4E00\u516C\u5E03\u7968\u578B\u3002" : pending.prompt.includes("[CURRENT TURN]") ? `\u8F6E\u5230\u4F60\u884C\u52A8 \xB7 ${werewolfPhaseLabelForHuman(game)}` : pending.prompt;
  panel.append(intro);
  for (const action of pending.expectedActions) {
    if (action === "pass") {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "werewolf-target-button";
      button.textContent = actionLabel(action);
      button.addEventListener("click", () => void submitWerewolfHumanAction({ actionType: action }));
      panel.append(button);
      continue;
    }
    let targets = pending.allowedTargets;
    if (action === "save") targets = game.night.wolfTarget ? [game.night.wolfTarget] : [];
    for (const target of targets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "werewolf-target-button";
      button.textContent = `${actionLabel(action)} ${target}\u53F7`;
      button.addEventListener("click", () => void submitWerewolfHumanAction({ actionType: action, targetSeat: target }));
      panel.append(button);
    }
  }
  dashboard.append(panel);
}
function renderWerewolfSetup() {
  messagesEl.replaceChildren();
  const card = document.createElement("section");
  card.className = "werewolf-setup-card";
  const icon = document.createElement("img");
  icon.src = chrome.runtime.getURL("SVG/\u72FC\u4EBA\u6740.svg");
  icon.alt = "";
  const title = document.createElement("h3");
  title.textContent = "AI \u72FC\u4EBA\u6740";
  const setup = state.werewolfSetup;
  const neededAi = setup.playerCount - (setup.includeHuman ? 1 : 0);
  const selected = state.settings.werewolfProviders.filter((provider) => providerById[provider]?.enabled);
  const body = document.createElement("p");
  body.textContent = `${setup.playerCount} \u4EBA\u5C40 \xB7 ${setup.includeHuman ? "\u4F60 + " : ""}${neededAi} \u4E2A AI \u73A9\u5BB6\u3002\u5F53\u524D\u5DF2\u9009\u62E9 ${selected.length} \u4E2A\u6A21\u578B\uFF0C\u6309\u8BBE\u7F6E\u4E2D\u7684\u987A\u5E8F\u53D6\u524D ${neededAi} \u4E2A\u3002\u70B9\u51FB\u4E0B\u65B9\u201C\u5F00\u59CB\u201D\u540E\u4F1A\u4E3A\u672C\u5C40\u521B\u5EFA\u5168\u65B0\u7684\u72EC\u7ACB\u7F51\u9875\u4F1A\u8BDD\u3002`;
  card.append(icon, title, body);
  messagesEl.append(card);
}
function renderWerewolfGame(game) {
  messagesEl.replaceChildren();
  const dashboard = document.createElement("section");
  dashboard.className = "werewolf-dashboard";
  const hero = document.createElement("div");
  hero.className = "werewolf-hero";
  const heroTitle = document.createElement("div");
  heroTitle.className = "werewolf-hero-title";
  const title = document.createElement("span");
  title.textContent = game.title;
  const status = document.createElement("span");
  status.textContent = game.status === "running" ? werewolfPhaseLabelForHuman(game) : werewolfStatusLabel(game);
  status.style.color = game.status === "error" || game.status === "paused" ? "var(--danger)" : "var(--muted)";
  status.style.fontSize = "10px";
  heroTitle.append(title, status);
  const sub = document.createElement("div");
  sub.className = "werewolf-hero-sub";
  sub.textContent = `${game.rulesetSnapshot.name} \xB7 \u7B2C ${game.day} \u5929 \xB7 ${werewolfPhaseLabelForHuman(game)} \xB7 Final-only \u56DE\u590D\u6A21\u5F0F`;
  hero.append(heroTitle, sub);
  dashboard.append(hero);
  const human = werewolfHumanPlayer(game);
  if (human) {
    const privateCard = document.createElement("div");
    privateCard.className = "werewolf-role-private";
    const wolfMates = human.role === "wolf" ? game.players.filter((player) => player.role === "wolf").map((player) => player.seat).join("\u3001") : "";
    privateCard.textContent = `\u4F60\u662F ${human.seat}\u53F7 \xB7 ${ROLE_LABELS[human.role]} \xB7 ${human.faction === "wolf" ? "\u72FC\u4EBA\u9635\u8425" : "\u597D\u4EBA\u9635\u8425"}\u3002${wolfMates ? `\u72FC\u4EBA\u540C\u4F34\uFF1A${wolfMates}\u53F7\uFF08\u542B\u4F60\uFF09\u3002` : ""}\u6E38\u620F\u4E2D\u7684\u79C1\u5BC6\u4FE1\u606F\u53EA\u4F1A\u663E\u793A\u5728\u4F60\u7684\u89C6\u89D2\u3002`;
    dashboard.append(privateCard);
  }
  const seats = document.createElement("div");
  seats.className = "werewolf-seat-grid";
  for (const player of [...game.players].sort((a, b) => a.seat - b.seat)) {
    const seat = document.createElement("div");
    seat.className = `werewolf-seat ${player.lifeState} ${player.controller === "human" ? "human" : ""}`;
    if (player.providerId) {
      const avatar = document.createElement("img");
      avatar.src = providerIconUrl(player.providerId);
      avatar.alt = "";
      seat.append(avatar);
    } else {
      const humanAvatar = document.createElement("div");
      humanAvatar.textContent = "\u4F60";
      humanAvatar.style.fontWeight = "650";
      humanAvatar.style.fontSize = "13px";
      seat.append(humanAvatar);
    }
    const name = document.createElement("strong");
    name.textContent = `${player.seat}\u53F7 \xB7 ${player.controller === "human" ? "\u4F60" : providerLabel(player.providerId)}`;
    const role = document.createElement("span");
    role.textContent = game.status === "ended" || player.controller === "human" ? ROLE_LABELS[player.role] : player.lifeState === "dead" ? "\u5DF2\u51FA\u5C40" : "\u8EAB\u4EFD\u9690\u85CF";
    seat.append(name, role);
    seats.append(seat);
  }
  dashboard.append(seats);
  const events = document.createElement("div");
  events.className = "werewolf-events";
  for (const event of humanVisibleEvents(game)) {
    if (!event.content) continue;
    const row = document.createElement("article");
    const author = event.authorSeat ? playerBySeatUi(game, event.authorSeat) : void 0;
    row.className = `werewolf-event ${event.visibility.type === "wolf" ? "wolf" : event.visibility.type === "private" ? "private" : ""} ${author?.providerId ? providerById[author.providerId].colorClass : ""}`;
    const meta = document.createElement("div");
    meta.className = "werewolf-event-meta";
    meta.textContent = event.authorSeat ? `${event.authorSeat}\u53F7 \xB7 ${author?.controller === "human" ? "\u4F60" : providerLabel(author?.providerId)}` : event.visibility.type === "wolf" ? "\u72FC\u4EBA\u9891\u9053" : event.visibility.type === "private" ? "\u79C1\u5BC6\u4FE1\u606F" : "\u4E3B\u6301\u4EBA";
    const body = document.createElement("div");
    body.className = "werewolf-event-body";
    body.innerHTML = renderMarkdown(event.content);
    decorateRenderedMarkdown(body);
    row.append(meta, body);
    if (author?.controller === "ai") row.append(createReplyActions(event.content));
    events.append(row);
  }
  dashboard.append(events);
  if (game.pendingTurn || game.pendingParallelTurns?.length) {
    const thinking = document.createElement("div");
    thinking.className = "werewolf-thinking";
    thinking.textContent = game.phase === "day_vote" || game.phase === "day_tiebreak_vote" ? `\u6295\u7968\u5904\u7406\u4E2D\u2026${game.pendingParallelTurns?.length ? ` \u5269\u4F59 ${game.pendingParallelTurns.length + (game.pendingHumanAction ? 1 : 0)} \u7968` : ""}` : canRevealPendingWerewolfActor(game) ? `${game.pendingTurn.seat}\u53F7 \xB7 ${providerLabel(game.pendingTurn.provider)} \u6B63\u5728\u601D\u8003\u2026` : game.phase.startsWith("wolf_") || game.phase === "seer_action" || game.phase === "witch_action" || game.phase === "night_start" || game.phase === "night_resolution" ? werewolfProgressLabel(game) : "\u6E38\u620F\u5904\u7406\u4E2D\u2026";
    dashboard.append(thinking);
  }
  if (game.pendingHumanAction) renderHumanActionPanel(game, game.pendingHumanAction, dashboard);
  messagesEl.append(dashboard);
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}
function playerBySeatUi(game, seat) {
  return game.players.find((player) => player.seat === seat);
}
function renderWerewolf() {
  const game = activeWerewolfGame();
  if (!game) renderWerewolfSetup();
  else renderWerewolfGame(game);
}
function fogCouncilPhaseLabel(game) {
  const labels = { setup: "\u5F85\u5F00\u59CB", briefing: "\u63A5\u6536\u7EBF\u7D22", debate: "\u516C\u5F00\u8FA9\u8BBA", ballot: "\u5BC6\u5C01\u8868\u51B3", ended: "\u6E38\u620F\u7ED3\u675F" };
  return labels[game.phase];
}
function fogCouncilStatusLabel(game) {
  if (game.status === "paused") return "\u5DF2\u6682\u505C" + (game.errorMessage ? " \xB7 " + game.errorMessage : "");
  if (game.status === "ended") return game.winner === "clarity" ? "\u6E05\u6670\u9635\u8425\u83B7\u80DC" : "\u8FF7\u96FE\u9635\u8425\u83B7\u80DC";
  return fogCouncilPhaseLabel(game);
}
function fogCouncilVisibleEvents(game) {
  return visibleCouncilEvents(game, game.humanSeat);
}
function fogCouncilHumanTextTurn(pending) {
  return pending?.kind === "speech";
}
function renderFogCouncilScript() {
  const body = el("fogCouncilScriptBody");
  body.replaceChildren();
  for (const role of COUNCIL_ROLES) {
    const row = document.createElement("div");
    row.className = "fog-council-role-row " + (role.faction === "clarity" ? "townsfolk" : "minion");
    const content = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = role.name + " \xB7 " + (role.faction === "clarity" ? "\u6E05\u6670\u9635\u8425" : "\u8FF7\u96FE\u9635\u8425");
    const desc = document.createElement("div");
    desc.className = "fog-council-role-description";
    desc.textContent = role.description;
    content.append(name, desc);
    row.append(content);
    body.append(row);
  }
}
function renderFogCouncilSetup() {
  messagesEl.replaceChildren();
  const card = document.createElement("section");
  card.className = "werewolf-setup-card";
  const image = document.createElement("img");
  image.src = chrome.runtime.getURL("SVG/\u8FF7\u96FE\u8BAE\u4F1A.svg");
  image.alt = "";
  const heading2 = document.createElement("h3");
  heading2.textContent = "AI \u8FF7\u96FE\u8BAE\u4F1A";
  const setup = state.fogCouncilSetup;
  const aiNeeded = setup.playerCount - (setup.includeHuman ? 1 : 0);
  const description = document.createElement("p");
  description.textContent = setup.playerCount + " \u4F4D\u8BAE\u5458\uFF0C\u4E94\u8F6E\u4FE1\u53F7\u63A8\u7406\u3002\u4E24\u540D\u8FF7\u96FE\u6210\u5458\u9690\u85CF\u8EAB\u4EFD\uFF0C\u6E05\u6670\u9635\u8425\u9700\u8981\u901A\u8FC7\u516C\u5F00\u8FA9\u8BBA\u548C\u5BC6\u5C01\u6295\u7968\u4FEE\u590D\u4E09\u4E2A\u9891\u9053\u3002\u5F53\u524D\u9700\u8981 " + aiNeeded + " \u4E2A\u5DF2\u767B\u5F55\u7684 AI \u6A21\u578B\uFF0C\u5F00\u5C40\u4E3A\u6BCF\u4F4D AI \u521B\u5EFA\u72EC\u7ACB\u7F51\u9875\u4F1A\u8BDD\u3002";
  card.append(image, heading2, description);
  messagesEl.append(card);
}
async function submitFogCouncilHumanAction(submission) {
  const game = activeFogCouncilGame();
  if (!game?.pendingHumanAction) return;
  try {
    await runtimeMessage({ type: "SUBMIT_FOG_COUNCIL_HUMAN_ACTION", gameId: game.id, submission });
    clearComposer();
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}
function renderFogCouncilGame(game) {
  messagesEl.replaceChildren();
  const dashboard = document.createElement("section");
  dashboard.className = "werewolf-dashboard";
  const hero = document.createElement("div");
  hero.className = "werewolf-hero";
  const title = document.createElement("div");
  title.className = "werewolf-hero-title";
  title.textContent = game.title + " \xB7 " + fogCouncilStatusLabel(game);
  const summary = document.createElement("p");
  summary.className = "werewolf-hero-sub";
  summary.textContent = "\u7B2C " + game.round + " \u8F6E \xB7 " + fogCouncilPhaseLabel(game) + " \xB7 \u6E05\u6670 " + game.clarityScore + " : " + game.mistScore + " \u8FF7\u96FE";
  hero.append(title, summary);
  dashboard.append(hero);
  const seats = document.createElement("div");
  seats.className = "werewolf-seat-grid";
  for (const player of game.players) {
    const seat = document.createElement("div");
    seat.className = "werewolf-seat " + (player.seat === game.humanSeat ? "human" : "");
    const name = document.createElement("strong");
    const provider = game.seatProviders[player.seat];
    name.textContent = player.seat + "\u53F7 \xB7 " + (provider ? providerLabel(provider) : "\u4F60");
    const role = document.createElement("span");
    role.textContent = game.status === "ended" || player.seat === game.humanSeat ? COUNCIL_ROLE_BY_ID[player.role].name : "\u8EAB\u4EFD\u9690\u85CF";
    seat.append(name, role);
    seats.append(seat);
  }
  dashboard.append(seats);
  if (game.humanSeat && game.current && game.status !== "ended") {
    const self = game.players.find((player) => player.seat === game.humanSeat);
    const clue = document.createElement("div");
    clue.className = "fog-council-private-card";
    clue.textContent = "\u4F60\u7684\u8EAB\u4EFD\uFF1A" + COUNCIL_ROLE_BY_ID[self.role].name + " \xB7 " + (self.faction === "clarity" ? "\u6E05\u6670" : "\u8FF7\u96FE") + "\u9635\u8425\u3002\u672C\u8F6E\u4FE1\u53F7\uFF1A" + game.current.clues[self.seat].text;
    dashboard.append(clue);
  }
  const events = document.createElement("div");
  events.className = "werewolf-events";
  for (const item of fogCouncilVisibleEvents(game)) {
    const row = document.createElement("article");
    row.className = "werewolf-event";
    const meta = document.createElement("div");
    meta.className = "werewolf-event-meta";
    meta.textContent = item.actorSeat ? item.actorSeat + "\u53F7\u8BAE\u5458" : "\u8BAE\u4F1A\u4E3B\u6301\u4EBA";
    const text2 = document.createElement("div");
    text2.className = "werewolf-event-body";
    text2.textContent = item.text;
    row.append(meta, text2);
    events.append(row);
  }
  dashboard.append(events);
  if (game.pendingTurn) {
    const thinking = document.createElement("p");
    thinking.className = "werewolf-thinking";
    thinking.textContent = game.pendingTurn.kind === "vote" ? "\u4E00\u540D\u8BAE\u5458\u6B63\u5728\u5BC6\u5C01\u8868\u51B3\u2026" : game.pendingTurn.seat + "\u53F7\u6B63\u5728\u53D1\u8A00\u2026";
    dashboard.append(thinking);
  }
  if (game.pendingHumanAction?.kind === "vote") {
    const panel = document.createElement("div");
    panel.className = "fog-council-human-actions";
    for (const channel of ["A", "B", "C"]) {
      const button = document.createElement("button");
      button.className = "fog-council-target-button";
      button.textContent = "\u5BC6\u5C01\u6295\u7968\uFF1A" + channel;
      button.addEventListener("click", () => void submitFogCouncilHumanAction({ channel }));
      panel.append(button);
    }
    dashboard.append(panel);
  }
  messagesEl.append(dashboard);
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}
function renderFogCouncil() {
  const game = activeFogCouncilGame();
  if (!game) renderFogCouncilSetup();
  else renderFogCouncilGame(game);
}
function renderMessages() {
  if (state.activeMode === "werewolf") {
    renderWerewolf();
    return;
  }
  if (state.activeMode === "fog_council") {
    renderFogCouncil();
    return;
  }
  const session = activeSession();
  messagesEl.replaceChildren();
  if (!session.messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = session.mode === "qa" ? "\u540C\u65F6\u5411\u591A\u4E2A AI \u63D0\u95EE\uFF0C\u56DE\u590D\u4F1A\u6309\u6A21\u578B\u5206\u522B\u663E\u793A\u3002" : session.mode === "roundtable" ? "\u8F93\u5165\u95EE\u9898\u5E76\u8BBE\u7F6E\u8F6E\u6570\uFF0CAI \u4F1A\u6309\u8BBE\u7F6E\u987A\u5E8F\u4F9D\u6B21\u63A5\u529B\u3002" : "\u9009\u62E9\u4E13\u5BB6\u9884\u8BBE\u540E\u5F00\u59CB\u8BA8\u8BBA\u3002\u4E13\u5BB6\u63D0\u793A\u8BCD\u53EA\u5728\u5404\u6A21\u578B\u9996\u6B21\u53D1\u8A00\u65F6\u6CE8\u5165\uFF0C\u4E0D\u5199\u5165\u4F1A\u8BDD\u6B63\u6587\u3002";
    messagesEl.appendChild(empty);
    return;
  }
  for (const message of session.messages) {
    const row = document.createElement("article");
    row.className = `message-row ${message.role}`;
    if (message.provider) row.classList.add(providerById[message.provider].colorClass);
    const meta = document.createElement("div");
    meta.className = "message-meta";
    if (message.role === "assistant" && message.provider) {
      const icon = document.createElement("img");
      icon.className = "provider-avatar";
      icon.src = providerIconUrl(message.provider);
      icon.alt = "";
      meta.append(icon);
    }
    const author = document.createElement("span");
    author.textContent = message.role === "user" ? "\u4F60" : providerDisplayLabel(session, message.provider);
    meta.append(author);
    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (message.role === "assistant") {
      bubble.innerHTML = renderMarkdown(message.text || (message.status === "pending" ? "\u2026" : ""));
      decorateRenderedMarkdown(bubble);
    } else {
      const text2 = document.createElement("div");
      text2.textContent = message.text;
      bubble.append(text2);
    }
    if (message.attachments?.length) {
      const files = document.createElement("div");
      files.className = "message-status";
      files.textContent = message.attachments.map((item) => `${item.kind === "image" ? "\u56FE\u7247" : "\u9644\u4EF6"}\uFF1A${item.name}`).join(" \xB7 ");
      bubble.append(files);
    }
    row.append(meta, bubble);
    if (message.role === "assistant" && message.text.trim()) row.append(createReplyActions(message.text));
    if (message.status && message.status !== "completed") {
      const status = document.createElement("div");
      status.className = `message-status ${message.status === "error" ? "error" : ""}`;
      status.textContent = message.status === "pending" ? "\u7B49\u5F85\u56DE\u590D" : message.status === "streaming" ? "\u751F\u6210\u4E2D" : message.status === "interrupted" ? "\u5DF2\u4E2D\u65AD" : message.error ?? "\u53D1\u9001\u5931\u8D25";
      row.append(status);
    }
    messagesEl.append(row);
  }
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}
function renderSequentialControls() {
  const session = activeSession();
  if (!isSequentialMode(session.mode)) return;
  const rounds = Math.max(1, Math.min(99, Number(session.rounds) || 1));
  roundNumber.value = String(rounds);
  roundRange.value = String(Math.min(8, rounds));
  const execution = session.execution;
  roundActionButton.textContent = execution?.status === "running" ? "\u4E2D\u65AD" : execution?.status === "paused" ? "\u7EE7\u7EED" : "\u5F00\u59CB";
  roundActionButton.classList.toggle("danger", execution?.status === "running");
  if (execution?.status === "running") {
    const operation = execution.currentOperationId ? session.pendingOperations?.[execution.currentOperationId] : void 0;
    const provider = operation?.provider ?? execution.providers[execution.providerIndex];
    roundtableStatus.textContent = `${provider ? `\u6B63\u5728\u7B49\u5F85 ${providerDisplayLabel(session, provider)}` : "\u51C6\u5907\u4E2D"} \xB7 ${execution.roundIndex + 1}/${execution.targetRounds} \u8F6E`;
  } else if (execution?.status === "paused") {
    roundtableStatus.textContent = `\u5DF2\u4E2D\u65AD\uFF0C\u53EF\u7EE7\u7EED \xB7 ${Math.min(execution.roundIndex + 1, execution.targetRounds)}/${execution.targetRounds} \u8F6E`;
  } else {
    roundtableStatus.textContent = "\u5F85\u5F00\u59CB";
  }
}
function renderWerewolfControls() {
  const game = activeWerewolfGame();
  const actionButton = el("werewolfActionButton");
  const status = el("werewolfStatus");
  const composer = el("composer");
  const attachButton = el("attachButton");
  const humanSend = el("werewolfHumanSendButton");
  const textTurn = humanTextTurn(game?.pendingHumanAction);
  composer.classList.toggle("hidden", !textTurn);
  composer.classList.toggle("werewolf-human-composer", textTurn);
  attachButton.classList.toggle("hidden", true);
  qaSendButton.classList.add("hidden");
  humanSend.classList.toggle("hidden", !textTurn);
  attachmentTray.classList.add("hidden");
  messageInput.placeholder = textTurn ? game?.pendingHumanAction?.kind === "last_word" ? "\u8F93\u5165\u4F60\u7684\u9057\u8A00\u2026" : game?.pendingHumanAction?.kind === "wolf_discussion" ? "\u8F93\u5165\u72FC\u4EBA\u79C1\u5BC6\u8BA8\u8BBA\u5185\u5BB9\u2026" : "\u8F93\u5165\u4F60\u7684\u516C\u5F00\u53D1\u8A00\u2026" : "\u8F93\u5165\u6D88\u606F\u2026";
  messageInput.rows = 2;
  if (!game) {
    actionButton.textContent = "\u5F00\u59CB";
    actionButton.classList.remove("danger");
    status.textContent = `${state.werewolfSetup.playerCount} \u4EBA\u5C40 \xB7 \u5F85\u5F00\u59CB`;
    return;
  }
  actionButton.textContent = game.status === "running" || game.status === "waiting_human" ? "\u4E2D\u65AD" : game.status === "paused" || game.status === "error" ? "\u7EE7\u7EED" : game.status === "ended" ? "\u65B0\u5C40" : "\u5F00\u59CB";
  actionButton.classList.toggle("danger", game.status === "running" || game.status === "waiting_human");
  status.textContent = game.status === "running" ? werewolfPhaseLabelForHuman(game) : werewolfStatusLabel(game);
}
async function handleWerewolfAction() {
  const game = activeWerewolfGame();
  try {
    if (!game) {
      const setup = state.werewolfSetup;
      const needed = setup.playerCount - (setup.includeHuman ? 1 : 0);
      const providers = state.settings.werewolfProviders.filter((provider) => providerById[provider]?.enabled);
      if (providers.length < needed) return showComposerError(`\u5F53\u524D ${setup.playerCount} \u4EBA\u914D\u7F6E\u81F3\u5C11\u9700\u8981 ${needed} \u4E2A\u5DF2\u63A5\u5165 AI \u6A21\u578B`);
      await refreshProviderAvailability(providers.slice(0, needed), false);
      const normalized = {
        ...setup,
        providerIds: providers,
        presetId: `werewolf-v1-${setup.playerCount}`
      };
      const response = await runtimeMessage({ type: "CREATE_WEREWOLF_GAME", setup: normalized });
      state.activeWerewolfGameId = response.gameId;
      await runtimeMessage({ type: "START_WEREWOLF_GAME", gameId: response.gameId });
      return;
    }
    if (game.status === "running" || game.status === "waiting_human") {
      await runtimeMessage({ type: "INTERRUPT_WEREWOLF_GAME", gameId: game.id });
      return;
    }
    if (game.status === "paused" || game.status === "error") {
      await runtimeMessage({ type: "RESUME_WEREWOLF_GAME", gameId: game.id });
      return;
    }
    if (game.status === "ended") {
      await runtimeMessage({ type: "SET_ACTIVE_WEREWOLF_GAME" });
      state.activeWerewolfGameId = void 0;
      renderMode();
      return;
    }
    await runtimeMessage({ type: "START_WEREWOLF_GAME", gameId: game.id });
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}
async function handleWerewolfHumanTextSend() {
  const game = activeWerewolfGame();
  if (!game?.pendingHumanAction || !humanTextTurn(game.pendingHumanAction)) return;
  const text2 = messageInput.value.trim();
  if (!text2) return showComposerError("\u8BF7\u8F93\u5165\u4F60\u7684\u53D1\u8A00");
  await submitWerewolfHumanAction({ text: text2 });
}
function renderFogCouncilControls() {
  const game = activeFogCouncilGame();
  const actionButton = el("fogCouncilActionButton");
  const status = el("fogCouncilStatus");
  const humanSend = el("fogCouncilHumanSendButton");
  const textTurn = fogCouncilHumanTextTurn(game?.pendingHumanAction);
  el("composer").classList.toggle("hidden", !textTurn);
  el("composer").classList.toggle("werewolf-human-composer", textTurn);
  el("attachButton").classList.add("hidden");
  qaSendButton.classList.add("hidden");
  humanSend.classList.toggle("hidden", !textTurn);
  attachmentTray.classList.add("hidden");
  messageInput.rows = 2;
  messageInput.placeholder = "\u8F93\u5165\u4F60\u7684\u8BAE\u4F1A\u53D1\u8A00\u2026";
  if (!game) {
    actionButton.textContent = "\u5F00\u59CB";
    actionButton.classList.remove("danger");
    status.textContent = state.fogCouncilSetup.playerCount + " \u4EBA \xB7 \u5F85\u5F00\u59CB";
    return;
  }
  actionButton.textContent = game.status === "running" ? "\u4E2D\u65AD" : game.status === "paused" ? "\u7EE7\u7EED" : game.status === "ended" ? "\u65B0\u5C40" : "\u5F00\u59CB";
  actionButton.classList.toggle("danger", game.status === "running");
  status.textContent = fogCouncilStatusLabel(game);
}
async function handleFogCouncilAction() {
  const game = activeFogCouncilGame();
  try {
    if (!game) {
      const setup = state.fogCouncilSetup;
      const needed = setup.playerCount - (setup.includeHuman ? 1 : 0);
      const providers = state.settings.fogCouncilProviders.filter((provider) => providerById[provider]?.enabled);
      if (providers.length < needed) return showComposerError("\u5F53\u524D\u81F3\u5C11\u9700\u8981 " + needed + " \u4E2A AI \u6A21\u578B");
      const selected = providers.slice(0, needed);
      await refreshProviderAvailability(selected, false);
      rejectKnownBrokenProviders(selected);
      const normalized = { ...setup, providerIds: selected };
      const response = await runtimeMessage({ type: "CREATE_FOG_COUNCIL_GAME", setup: normalized });
      state.activeFogCouncilGameId = response.gameId;
      await runtimeMessage({ type: "START_FOG_COUNCIL_GAME", gameId: response.gameId });
      return;
    }
    if (game.status === "running") await runtimeMessage({ type: "INTERRUPT_FOG_COUNCIL_GAME", gameId: game.id });
    else if (game.status === "paused") await runtimeMessage({ type: "RESUME_FOG_COUNCIL_GAME", gameId: game.id });
    else if (game.status === "ended") {
      await runtimeMessage({ type: "SET_ACTIVE_FOG_COUNCIL_GAME" });
      state.activeFogCouncilGameId = void 0;
      renderMode();
    } else await runtimeMessage({ type: "START_FOG_COUNCIL_GAME", gameId: game.id });
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}
async function handleFogCouncilHumanTextSend() {
  const pending = activeFogCouncilGame()?.pendingHumanAction;
  if (!pending || pending.kind !== "speech") return;
  const text2 = messageInput.value.trim();
  if (!text2) return showComposerError("\u8BF7\u8F93\u5165\u4F60\u7684\u8BAE\u4F1A\u53D1\u8A00");
  await submitFogCouncilHumanAction({ text: text2 });
}
function renderMode() {
  document.querySelectorAll(".mode-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === state.activeMode));
  const sequential = isSequentialMode(state.activeMode);
  const werewolf = state.activeMode === "werewolf";
  const fogCouncil = state.activeMode === "fog_council";
  roundControls.classList.toggle("hidden", !sequential);
  el("werewolfControls").classList.toggle("hidden", !werewolf);
  el("fogCouncilControls").classList.toggle("hidden", !fogCouncil);
  qaSendButton.classList.toggle("hidden", sequential || werewolf || fogCouncil);
  el("werewolfHumanSendButton").classList.add("hidden");
  el("fogCouncilHumanSendButton").classList.add("hidden");
  if (!werewolf && !fogCouncil) {
    el("composer").classList.remove("hidden");
    el("attachButton").classList.remove("hidden");
    messageInput.placeholder = "\u8F93\u5165\u6D88\u606F\uFF0C\u6216\u7C98\u8D34\u56FE\u7247/\u9644\u4EF6\u2026";
  }
  el("newConversationButton").title = state.activeMode === "werewolf" ? "\u65B0\u72FC\u4EBA\u6740\u5BF9\u5C40" : state.activeMode === "fog_council" ? "\u65B0\u8FF7\u96FE\u8BAE\u4F1A\u5BF9\u5C40" : `\u65B0${modeLabel(state.activeMode)}\u4F1A\u8BDD`;
  renderMessages();
  if (sequential) renderSequentialControls();
  if (werewolf) renderWerewolfControls();
  if (fogCouncil) renderFogCouncilControls();
}
function renderAttachmentTray() {
  attachmentTray.replaceChildren();
  attachmentTray.classList.toggle("hidden", draftAttachments.length === 0);
  for (const attachment of draftAttachments) {
    const chip = document.createElement("div");
    chip.className = "attachment-chip";
    const name = document.createElement("span");
    name.textContent = `${attachment.kind === "image" ? "\u56FE\u7247" : "\u9644\u4EF6"} \xB7 ${attachment.name}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "\xD7";
    remove.addEventListener("click", () => {
      draftAttachments = draftAttachments.filter((item) => item.id !== attachment.id);
      renderAttachmentTray();
    });
    chip.append(name, remove);
    attachmentTray.append(chip);
  }
}
async function fileToAttachment(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25"));
    reader.readAsDataURL(file);
  });
  return {
    id: id("attachment"),
    name: file.name || "\u526A\u8D34\u677F\u56FE\u7247",
    type: file.type,
    size: file.size,
    dataUrl,
    kind: file.type.startsWith("image/") ? "image" : "attachment"
  };
}
async function addFiles(files) {
  const added = await Promise.all([...files].map(fileToAttachment));
  draftAttachments.push(...added);
  renderAttachmentTray();
}
function takeComposerPayload() {
  const text2 = messageInput.value.trim();
  if (!text2 && !draftAttachments.length) return null;
  return { text: text2, attachments: draftAttachments.map((item) => ({ ...item })) };
}
function clearComposer() {
  messageInput.value = "";
  messageInput.style.height = "";
  draftAttachments = [];
  fileInput.value = "";
  renderAttachmentTray();
}
function attachmentMetadata(payload) {
  return payload.attachments.map(({ id: id2, name, type, size, kind }) => ({ id: id2, name, type, size, kind }));
}
async function runtimeMessage(message) {
  const response = await chrome.runtime.sendMessage(message);
  if (response && response.success === false) throw new Error(response.error || "\u6269\u5C55\u64CD\u4F5C\u5931\u8D25");
  return response;
}
async function refreshProviderAvailability(providers, rerenderSettings = true) {
  const unique = [...new Set(providers)].filter((provider) => providerById[provider]?.enabled);
  if (!unique.length) return;
  try {
    const response = await runtimeMessage({ type: "GET_PROVIDER_STATUS", providers: unique });
    for (const status of response.statuses ?? []) {
      providerAvailability.set(status.provider, {
        state: status.state,
        connected: status.connected,
        reason: status.reason
      });
    }
  } catch {
    for (const provider of unique) {
      if (!providerAvailability.has(provider)) providerAvailability.set(provider, { state: "unknown", connected: false, reason: "\u72B6\u6001\u68C0\u6D4B\u5931\u8D25" });
    }
  }
  if (rerenderSettings && !el("settingsOverlay").classList.contains("hidden")) renderSettings();
}
function rejectKnownBrokenProviders(providers) {
  const broken = providers.map((provider) => ({ provider, status: providerAvailability.get(provider) })).filter(({ status }) => status?.state === "error");
  if (!broken.length) return;
  const detail = broken.map(({ provider, status }) => `${providerLabel(provider)}\uFF1A${status?.reason || "\u5F53\u524D\u4E0D\u53EF\u7528"}`).join("\uFF1B");
  throw new Error(`\u4EE5\u4E0B\u6A21\u578B\u5F53\u524D\u4E0D\u53EF\u7528\uFF1A${detail}`);
}
async function handleQaSend() {
  const payload = takeComposerPayload();
  if (!payload) return;
  const session = activeSession();
  const providers = state.settings.qaProviders.filter((provider) => providerById[provider].enabled);
  if (!providers.length) return showComposerError("\u8BF7\u5148\u5728\u8BBE\u7F6E\u91CC\u9009\u62E9\u81F3\u5C11\u4E00\u4E2A\u5DF2\u63A5\u5165\u6A21\u578B");
  await refreshProviderAvailability(providers, false);
  session.messages.push({ id: id("msg"), role: "user", text: payload.text, attachments: attachmentMetadata(payload), createdAt: Date.now(), status: "completed" });
  if (session.title === "\u65B0\u4F1A\u8BDD") session.title = deriveTitle(payload);
  touchSession(session);
  clearComposer();
  renderMessages();
  await saveState(state);
  try {
    await runtimeMessage({ type: "START_QA_SESSION", sessionId: session.id, providers, payload });
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}
async function handleSequentialAction() {
  const session = activeSession();
  if (!isSequentialMode(session.mode)) return;
  if (session.execution?.status === "running") {
    await runtimeMessage({ type: "INTERRUPT_SESSION", sessionId: session.id }).catch((error) => showComposerError(error.message));
    return;
  }
  if (session.execution?.status === "paused") {
    const supplementalPayload = takeComposerPayload();
    try {
      await refreshProviderAvailability(session.execution.providers, false);
      await runtimeMessage({
        type: "RESUME_SEQUENTIAL_SESSION",
        sessionId: session.id,
        payload: supplementalPayload ?? void 0
      });
      if (supplementalPayload) clearComposer();
    } catch (error) {
      showComposerError(error instanceof Error ? error.message : String(error));
    }
    return;
  }
  const payload = takeComposerPayload();
  if (!payload) return showComposerError("\u8BF7\u8F93\u5165\u95EE\u9898\u6216\u6DFB\u52A0\u9644\u4EF6");
  const providers = providersForMode(session.mode).filter((provider) => providerById[provider].enabled);
  if (providers.length < 2) return showComposerError(`${modeLabel(session.mode)}\u81F3\u5C11\u9009\u62E9\u4E24\u4E2A\u5DF2\u63A5\u5165\u6A21\u578B`);
  await refreshProviderAvailability(providers, false);
  if (session.mode === "expert" && session.messages.length === 0) {
    session.expertAssignments = captureExpertAssignments();
    session.expertInitializedProviders = [];
  }
  session.messages.push({ id: id("msg"), role: "user", text: payload.text, attachments: attachmentMetadata(payload), createdAt: Date.now(), status: "completed" });
  if (session.title === "\u65B0\u4F1A\u8BDD") session.title = deriveTitle(payload);
  touchSession(session);
  clearComposer();
  renderMessages();
  renderSequentialControls();
  await saveState(state);
  try {
    await runtimeMessage({
      type: "START_SEQUENTIAL_SESSION",
      sessionId: session.id,
      providers,
      payload,
      targetRounds: Math.max(1, Math.min(99, session.rounds))
    });
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}
function showComposerError(text2) {
  const toast = el("toast");
  toast.textContent = text2;
  toast.classList.remove("hidden");
  window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 4e3);
}
function providerOptionBase(providerId, checked) {
  const provider = providerById[providerId];
  const row = document.createElement("div");
  row.className = `provider-option ${provider.enabled ? "" : "disabled"}`;
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = checked;
  checkbox.disabled = !provider.enabled;
  const icon = document.createElement("img");
  icon.className = "provider-setting-icon";
  icon.src = providerIconUrl(providerId);
  icon.alt = "";
  const name = document.createElement("span");
  name.className = "provider-option-name";
  name.textContent = provider.label;
  const availability = providerAvailability.get(providerId);
  const statusDot = document.createElement("span");
  const statusState = availability?.state ?? "unknown";
  statusDot.className = `provider-status-dot ${statusState}`;
  statusDot.setAttribute("aria-label", availability?.reason ?? (statusState === "ready" ? "\u5DF2\u767B\u5F55\uFF0C\u53EF\u7528" : statusState === "error" ? "\u4E0D\u53EF\u7528\u6216\u672A\u767B\u5F55" : "\u672A\u68C0\u6D4B\u6216\u9875\u9762\u672A\u6253\u5F00"));
  statusDot.title = availability?.reason ?? (statusState === "ready" ? "\u5DF2\u767B\u5F55\uFF0C\u53EF\u7528" : statusState === "error" ? "\u4E0D\u53EF\u7528\u6216\u672A\u767B\u5F55" : "\u672A\u68C0\u6D4B\u6216\u9875\u9762\u672A\u6253\u5F00");
  row.append(checkbox, icon, name, statusDot);
  if (!provider.enabled) {
    const badge = document.createElement("small");
    badge.textContent = "\u5F85\u63A5\u5165";
    row.append(badge);
  }
  return { row, checkbox };
}
function renderQaSettings() {
  const container = el("qaProviderSettings");
  container.replaceChildren();
  for (const provider of PROVIDERS) {
    const { row, checkbox } = providerOptionBase(provider.id, state.settings.qaProviders.includes(provider.id));
    checkbox.addEventListener("change", async () => {
      const set = new Set(state.settings.qaProviders);
      checkbox.checked ? set.add(provider.id) : set.delete(provider.id);
      state.settings.qaProviders = PROVIDERS.map((item) => item.id).filter((providerId) => set.has(providerId));
      await saveState(state);
    });
    container.append(row);
  }
}
function selectedProviders(mode) {
  void mode;
  return state.settings.roundtableProviders;
}
function setSelectedProviders(mode, providers) {
  void mode;
  state.settings.roundtableProviders = providers;
}
function syncBlankExpertSessionAssignments() {
  const session = ensureActiveSession("expert");
  if (!session.messages.length) session.expertAssignments = captureExpertAssignments();
}
function renderSequentialSettings(mode, containerId) {
  const container = el(containerId);
  container.replaceChildren();
  const selected = selectedProviders(mode);
  const ordered = [...selected.map((providerId) => providerById[providerId]).filter(Boolean), ...PROVIDERS.filter((provider) => !selected.includes(provider.id))];
  for (const provider of ordered) {
    const { row, checkbox } = providerOptionBase(provider.id, selected.includes(provider.id));
    checkbox.addEventListener("change", async () => {
      const next = [...selectedProviders(mode)];
      if (checkbox.checked && !next.includes(provider.id)) next.push(provider.id);
      if (!checkbox.checked) {
        const index = next.indexOf(provider.id);
        if (index >= 0) next.splice(index, 1);
      }
      setSelectedProviders(mode, next);
      syncBlankExpertSessionAssignments();
      await saveState(state);
      renderSequentialSettings(mode, containerId);
    });
    if (provider.enabled) {
      const select = document.createElement("select");
      select.className = "expert-select";
      select.title = "\u9009\u62E9\u4E13\u5BB6\u9884\u8BBE";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "None";
      select.append(none);
      for (const preset of state.expertPresets) {
        const option = document.createElement("option");
        option.value = preset.id;
        option.textContent = preset.name;
        select.append(option);
      }
      select.value = state.settings.expertPresetByProvider[provider.id] ?? "";
      select.addEventListener("change", async () => {
        if (select.value) state.settings.expertPresetByProvider[provider.id] = select.value;
        else delete state.settings.expertPresetByProvider[provider.id];
        syncBlankExpertSessionAssignments();
        await saveState(state);
      });
      row.append(select);
    }
    if (provider.enabled && checkbox.checked) {
      const index = selectedProviders(mode).indexOf(provider.id);
      const up = document.createElement("button");
      up.type = "button";
      up.className = "order-button";
      up.textContent = "\u2191";
      up.title = "\u63D0\u524D\u53D1\u8A00";
      up.disabled = index <= 0;
      up.addEventListener("click", async () => {
        if (index <= 0) return;
        const next = [...selectedProviders(mode)];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        setSelectedProviders(mode, next);
        await saveState(state);
        renderSequentialSettings(mode, containerId);
      });
      const down = document.createElement("button");
      down.type = "button";
      down.className = "order-button";
      down.textContent = "\u2193";
      down.title = "\u5EF6\u540E\u53D1\u8A00";
      down.disabled = index < 0 || index >= selectedProviders(mode).length - 1;
      down.addEventListener("click", async () => {
        if (index < 0 || index >= selectedProviders(mode).length - 1) return;
        const next = [...selectedProviders(mode)];
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
        setSelectedProviders(mode, next);
        await saveState(state);
        renderSequentialSettings(mode, containerId);
      });
      row.append(up, down);
    }
    container.append(row);
  }
}
async function persistWerewolfSettings() {
  state.werewolfSetup.providerIds = [...state.settings.werewolfProviders];
  state.werewolfSetup.presetId = `werewolf-v1-${state.werewolfSetup.playerCount}`;
  await saveState(state);
  await runtimeMessage({ type: "UPDATE_WEREWOLF_SETUP", setup: state.werewolfSetup });
}
function renderWerewolfSettings() {
  const container = el("werewolfProviderSettings");
  const countSelect = el("werewolfPlayerCount");
  const humanToggle = el("werewolfIncludeHuman");
  const humanSeat = el("werewolfHumanSeat");
  countSelect.value = String(state.werewolfSetup.playerCount);
  humanToggle.checked = state.werewolfSetup.includeHuman;
  humanSeat.replaceChildren();
  const randomOption = document.createElement("option");
  randomOption.value = "0";
  randomOption.textContent = "\u968F\u673A";
  humanSeat.append(randomOption);
  for (let seat = 1; seat <= state.werewolfSetup.playerCount; seat += 1) {
    const option = document.createElement("option");
    option.value = String(seat);
    option.textContent = `${seat}\u53F7`;
    humanSeat.append(option);
  }
  humanSeat.value = String(state.werewolfSetup.humanSeat <= state.werewolfSetup.playerCount ? state.werewolfSetup.humanSeat : 0);
  humanSeat.disabled = !state.werewolfSetup.includeHuman;
  countSelect.onchange = async () => {
    const value = Number(countSelect.value);
    state.werewolfSetup.playerCount = value;
    if (state.werewolfSetup.humanSeat > value) state.werewolfSetup.humanSeat = 0;
    await persistWerewolfSettings();
    renderWerewolfSettings();
    if (state.activeMode === "werewolf" && !activeWerewolfGame()) renderMode();
  };
  humanToggle.onchange = async () => {
    state.werewolfSetup.includeHuman = humanToggle.checked;
    if (!humanToggle.checked) state.werewolfSetup.humanSeat = 0;
    await persistWerewolfSettings();
    renderWerewolfSettings();
    if (state.activeMode === "werewolf" && !activeWerewolfGame()) renderMode();
  };
  humanSeat.onchange = async () => {
    state.werewolfSetup.humanSeat = Number(humanSeat.value);
    await persistWerewolfSettings();
  };
  container.replaceChildren();
  const selected = state.settings.werewolfProviders;
  const ordered = [...selected.map((providerId) => providerById[providerId]).filter(Boolean), ...PROVIDERS.filter((provider) => !selected.includes(provider.id))];
  for (const provider of ordered) {
    const { row, checkbox } = providerOptionBase(provider.id, selected.includes(provider.id));
    checkbox.addEventListener("change", async () => {
      const next = [...state.settings.werewolfProviders];
      if (checkbox.checked && !next.includes(provider.id)) next.push(provider.id);
      if (!checkbox.checked) {
        const index = next.indexOf(provider.id);
        if (index >= 0) next.splice(index, 1);
      }
      state.settings.werewolfProviders = next;
      await persistWerewolfSettings();
      renderWerewolfSettings();
      if (state.activeMode === "werewolf" && !activeWerewolfGame()) renderMode();
    });
    if (provider.enabled && checkbox.checked) {
      const index = state.settings.werewolfProviders.indexOf(provider.id);
      const up = document.createElement("button");
      up.type = "button";
      up.className = "order-button";
      up.textContent = "\u2191";
      up.title = "\u63D0\u524D\u5EA7\u4F4D\u987A\u5E8F";
      up.disabled = index <= 0;
      up.addEventListener("click", async () => {
        if (index <= 0) return;
        const next = [...state.settings.werewolfProviders];
        [next[index - 1], next[index]] = [next[index], next[index - 1]];
        state.settings.werewolfProviders = next;
        await persistWerewolfSettings();
        renderWerewolfSettings();
      });
      const down = document.createElement("button");
      down.type = "button";
      down.className = "order-button";
      down.textContent = "\u2193";
      down.title = "\u5EF6\u540E\u5EA7\u4F4D\u987A\u5E8F";
      down.disabled = index >= state.settings.werewolfProviders.length - 1;
      down.addEventListener("click", async () => {
        if (index < 0 || index >= state.settings.werewolfProviders.length - 1) return;
        const next = [...state.settings.werewolfProviders];
        [next[index + 1], next[index]] = [next[index], next[index + 1]];
        state.settings.werewolfProviders = next;
        await persistWerewolfSettings();
        renderWerewolfSettings();
      });
      row.append(up, down);
    }
    container.append(row);
  }
}
async function persistFogCouncilSettings() {
  state.fogCouncilSetup.providerIds = [...state.settings.fogCouncilProviders];
  await saveState(state);
  await runtimeMessage({ type: "UPDATE_FOG_COUNCIL_SETUP", setup: state.fogCouncilSetup });
}
function renderFogCouncilSettings() {
  const container = el("fogCouncilProviderSettings");
  const countSelect = el("fogCouncilPlayerCount");
  const humanToggle = el("fogCouncilIncludeHuman");
  const humanSeat = el("fogCouncilHumanSeat");
  const setup = state.fogCouncilSetup;
  countSelect.value = String(setup.playerCount);
  humanToggle.checked = setup.includeHuman;
  humanSeat.replaceChildren();
  const random = document.createElement("option");
  random.value = "0";
  random.textContent = "\u968F\u673A";
  humanSeat.append(random);
  for (let seat = 1; seat <= setup.playerCount; seat++) {
    const option = document.createElement("option");
    option.value = String(seat);
    option.textContent = seat + "\u53F7";
    humanSeat.append(option);
  }
  humanSeat.value = String(setup.humanSeat <= setup.playerCount ? setup.humanSeat : 0);
  humanSeat.disabled = !setup.includeHuman;
  countSelect.onchange = async () => {
    setup.playerCount = Number(countSelect.value);
    if (setup.humanSeat > setup.playerCount) setup.humanSeat = 0;
    await persistFogCouncilSettings();
    renderFogCouncilSettings();
    if (state.activeMode === "fog_council" && !activeFogCouncilGame()) renderMode();
  };
  humanToggle.onchange = async () => {
    setup.includeHuman = humanToggle.checked;
    if (!setup.includeHuman) setup.humanSeat = 0;
    await persistFogCouncilSettings();
    renderFogCouncilSettings();
    if (state.activeMode === "fog_council" && !activeFogCouncilGame()) renderMode();
  };
  humanSeat.onchange = async () => {
    setup.humanSeat = Number(humanSeat.value);
    await persistFogCouncilSettings();
  };
  container.replaceChildren();
  const selected = state.settings.fogCouncilProviders;
  const ordered = [
    ...selected.map((id2) => providerById[id2]).filter(Boolean),
    ...PROVIDERS.filter((provider) => !selected.includes(provider.id))
  ];
  for (const provider of ordered) {
    const { row, checkbox } = providerOptionBase(provider.id, selected.includes(provider.id));
    checkbox.addEventListener("change", async () => {
      const next = [...state.settings.fogCouncilProviders];
      if (checkbox.checked && !next.includes(provider.id)) next.push(provider.id);
      if (!checkbox.checked) {
        const index = next.indexOf(provider.id);
        if (index >= 0) next.splice(index, 1);
      }
      state.settings.fogCouncilProviders = next;
      await persistFogCouncilSettings();
      renderFogCouncilSettings();
      if (state.activeMode === "fog_council" && !activeFogCouncilGame()) renderMode();
    });
    if (provider.enabled && checkbox.checked) {
      const index = selected.indexOf(provider.id);
      for (const [label, step] of [["\u2191", -1], ["\u2193", 1]]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "order-button";
        button.textContent = label;
        button.disabled = index + step < 0 || index + step >= selected.length;
        button.addEventListener("click", async () => {
          const next = [...state.settings.fogCouncilProviders];
          [next[index], next[index + step]] = [next[index + step], next[index]];
          state.settings.fogCouncilProviders = next;
          await persistFogCouncilSettings();
          renderFogCouncilSettings();
        });
        row.append(button);
      }
    }
    container.append(row);
  }
}
function renderSettings() {
  const acceleration = el("replyAcceleration");
  acceleration.checked = state.settings.replyAcceleration !== false;
  acceleration.onchange = () => {
    state.settings.replyAcceleration = acceleration.checked;
    void saveState(state).catch((error) => showComposerError(error instanceof Error ? error.message : String(error)));
  };
  renderQaSettings();
  renderSequentialSettings("roundtable", "roundtableProviderSettings");
  renderWerewolfSettings();
  renderFogCouncilSettings();
}
function actionIconButton(icon, title) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "mini-icon-button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.innerHTML = icon;
  return button;
}
function closeExpertEditor() {
  editingExpertId = null;
  el("expertNameInput").value = "";
  el("expertPromptInput").value = "";
  el("expertPresetHint").textContent = "";
  el("expertEditor").classList.add("hidden");
}
function openExpertEditor(preset) {
  editingExpertId = preset?.id ?? null;
  el("expertNameInput").value = preset?.name ?? "";
  el("expertPromptInput").value = preset?.prompt ?? "";
  el("expertPresetHint").textContent = "";
  el("expertEditor").classList.remove("hidden");
  el("expertNameInput").focus();
}
function renderExpertPresets() {
  const list2 = el("expertPresetList");
  list2.replaceChildren();
  if (!state.expertPresets.length) {
    const empty = document.createElement("p");
    empty.className = "drawer-empty";
    empty.textContent = "\u8FD8\u6CA1\u6709\u4E13\u5BB6\u9884\u8BBE\u3002";
    list2.append(empty);
    return;
  }
  for (const preset of state.expertPresets) {
    const row = document.createElement("div");
    row.className = "expert-row";
    const name = document.createElement("span");
    name.textContent = preset.name;
    const edit2 = actionIconButton(ICON_EDIT, "\u7F16\u8F91\u4E13\u5BB6");
    edit2.addEventListener("click", () => openExpertEditor(preset));
    const remove = actionIconButton(ICON_DELETE, "\u5220\u9664\u4E13\u5BB6");
    remove.addEventListener("click", async () => {
      if (!window.confirm(`\u5220\u9664\u4E13\u5BB6\u201C${preset.name}\u201D\uFF1F\u5DF2\u6709\u5386\u53F2\u4F1A\u8BDD\u4E2D\u7684\u4E13\u5BB6\u5FEB\u7167\u4E0D\u4F1A\u53D7\u5F71\u54CD\u3002`)) return;
      state.expertPresets = state.expertPresets.filter((item) => item.id !== preset.id);
      for (const provider of PROVIDERS) {
        if (state.settings.expertPresetByProvider[provider.id] === preset.id) delete state.settings.expertPresetByProvider[provider.id];
      }
      syncBlankExpertSessionAssignments();
      await saveState(state);
      renderExpertPresets();
      renderSettings();
      if (editingExpertId === preset.id) closeExpertEditor();
    });
    row.append(name, edit2, remove);
    list2.append(row);
  }
}
async function saveExpertPreset() {
  const name = el("expertNameInput").value.trim();
  const prompt = el("expertPromptInput").value.trim();
  const hint = el("expertPresetHint");
  if (!name || !prompt) {
    hint.textContent = "\u540D\u79F0\u548C\u9884\u8BBE\u63D0\u793A\u8BCD\u90FD\u4E0D\u80FD\u4E3A\u7A7A\u3002";
    return;
  }
  const now = Date.now();
  if (editingExpertId) {
    const preset = state.expertPresets.find((item) => item.id === editingExpertId);
    if (preset) Object.assign(preset, { name, prompt, updatedAt: now });
  } else {
    state.expertPresets.push({ id: id("expert"), name, prompt, createdAt: now, updatedAt: now });
  }
  syncBlankExpertSessionAssignments();
  await saveState(state);
  closeExpertEditor();
  renderExpertPresets();
  renderSettings();
}
function exportExpertPresets() {
  if (!state.expertPresets.length) {
    showComposerError("\u5F53\u524D\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u4E13\u5BB6\u9884\u8BBE\u3002");
    return;
  }
  const payload = buildExpertPresetTransferFile(state.expertPresets);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `multi-ai-roundtable-experts-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
  showComposerError(`\u5DF2\u5BFC\u51FA ${state.expertPresets.length} \u4E2A\u4E13\u5BB6\u9884\u8BBE\u3002`);
}
async function importExpertPresets(file) {
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("JSON \u6587\u4EF6\u8D85\u8FC7 5 MB\uFF0C\u5DF2\u62D2\u7EDD\u5BFC\u5165\u3002");
    const incoming = parseExpertPresetTransferFile(await file.text());
    const merged = mergeExpertPresets(state.expertPresets, incoming, Date.now(), () => id("expert"));
    state.expertPresets = merged.presets;
    syncBlankExpertSessionAssignments();
    await saveState(state);
    closeExpertEditor();
    renderExpertPresets();
    renderSettings();
    const parts = [`\u65B0\u589E ${merged.added}`];
    if (merged.updated) parts.push(`\u66F4\u65B0 ${merged.updated}`);
    if (merged.unchanged) parts.push(`\u672A\u53D8 ${merged.unchanged}`);
    showComposerError(`\u4E13\u5BB6\u9884\u8BBE\u5BFC\u5165\u5B8C\u6210\uFF1A${parts.join("\uFF0C")}\u3002`);
  } catch (error) {
    showComposerError(error instanceof Error ? `\u5BFC\u5165\u5931\u8D25\uFF1A${error.message}` : "\u5BFC\u5165\u5931\u8D25\uFF1A\u672A\u77E5\u9519\u8BEF");
  }
}
function sessionMarkdown(session) {
  const lines = [`# ${session.title}`, "", `- \u7C7B\u578B\uFF1A${modeLabel(session.mode)}`, `- \u521B\u5EFA\u65F6\u95F4\uFF1A${new Date(session.createdAt).toLocaleString()}`, `- \u66F4\u65B0\u65F6\u95F4\uFF1A${new Date(session.updatedAt).toLocaleString()}`];
  if (session.mode === "expert") {
    const assignments = Object.entries(session.expertAssignments ?? {});
    const labels = assignments.filter(([, expert]) => expert?.name).map(([provider, expert]) => `${providerLabel(provider)}\uFF1A${expert.name}`);
    if (labels.length) lines.push(`- \u4E13\u5BB6\u914D\u7F6E\uFF1A${labels.join("\uFF1B")}`);
  }
  lines.push("", "## \u5BF9\u8BDD", "");
  for (const message of session.messages) {
    if (message.role === "system") continue;
    const author = message.role === "user" ? "\u7528\u6237" : providerDisplayLabel(session, message.provider);
    lines.push(`### ${author}`, "", message.text || (message.status === "interrupted" ? "*\u5DF2\u4E2D\u65AD*" : ""), "");
    if (message.attachments?.length) {
      lines.push(message.attachments.map((item) => `- ${item.kind === "image" ? "\u56FE\u7247" : "\u9644\u4EF6"}\uFF1A${item.name}`).join("\n"), "");
    }
    if (message.error) lines.push(`> \u9519\u8BEF\uFF1A${message.error}`, "");
  }
  return lines.join("\n").trimEnd() + "\n";
}
function exportSession(session) {
  const blob = new Blob([sessionMarkdown(session)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${session.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 48) || "conversation"}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function werewolfGameMarkdown(game) {
  const human = werewolfHumanPlayer(game);
  const lines = [
    `# ${game.title}`,
    "",
    "- \u7C7B\u578B\uFF1A\u72FC\u4EBA\u6740",
    `- \u89C4\u5219\uFF1A${game.rulesetSnapshot.name}`,
    `- \u72B6\u6001\uFF1A${werewolfStatusLabel(game)}`,
    `- \u521B\u5EFA\u65F6\u95F4\uFF1A${new Date(game.createdAt).toLocaleString()}`,
    `- \u66F4\u65B0\u65F6\u95F4\uFF1A${new Date(game.updatedAt).toLocaleString()}`
  ];
  if (human) lines.push(`- \u4F60\u7684\u5EA7\u4F4D\uFF1A${human.seat}\u53F7`, `- \u4F60\u7684\u8EAB\u4EFD\uFF1A${ROLE_LABELS[human.role]}`);
  if (game.status === "ended") {
    lines.push(`- \u83B7\u80DC\u9635\u8425\uFF1A${game.winner === "wolf" ? "\u72FC\u4EBA\u9635\u8425" : "\u597D\u4EBA\u9635\u8425"}`);
    lines.push(`- \u6700\u7EC8\u8EAB\u4EFD\uFF1A${[...game.players].sort((a, b) => a.seat - b.seat).map((player) => `${player.seat}\u53F7 ${ROLE_LABELS[player.role]}`).join("\uFF1B")}`);
  }
  lines.push("", "## \u6E38\u620F\u8BB0\u5F55", "");
  for (const event of humanVisibleEvents(game)) {
    if (!event.content || event.visibility.type === "system") continue;
    const author = event.authorSeat ? `${event.authorSeat}\u53F7${playerBySeatUi(game, event.authorSeat)?.controller === "human" ? " \xB7 \u4F60" : ""}` : event.visibility.type === "wolf" ? "\u72FC\u4EBA\u9891\u9053" : event.visibility.type === "private" ? "\u79C1\u5BC6\u4FE1\u606F" : "\u4E3B\u6301\u4EBA";
    lines.push(`### ${author}`, "", event.content, "");
  }
  return lines.join("\n").trimEnd() + "\n";
}
function exportWerewolfGame(game) {
  const blob = new Blob([werewolfGameMarkdown(game)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${game.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 48) || "werewolf"}.md`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function fogCouncilGameMarkdown(game) {
  const lines = [
    "# " + game.title,
    "",
    "- \u7C7B\u578B\uFF1AAI \u8FF7\u96FE\u8BAE\u4F1A",
    "- \u72B6\u6001\uFF1A" + fogCouncilStatusLabel(game),
    "- \u6E05\u6670\u9635\u8425\uFF1A" + game.clarityScore + " \u5206",
    "- \u8FF7\u96FE\u9635\u8425\uFF1A" + game.mistScore + " \u5206",
    "- \u521B\u5EFA\u65F6\u95F4\uFF1A" + new Date(game.createdAt).toLocaleString(),
    ""
  ];
  if (game.humanSeat) {
    const human = game.players.find((p) => p.seat === game.humanSeat);
    lines.push("- \u6211\u7684\u8EAB\u4EFD\uFF1A" + COUNCIL_ROLE_BY_ID[human.role].name);
  }
  if (game.status === "ended") {
    lines.push("- \u83B7\u80DC\u9635\u8425\uFF1A" + (game.winner === "clarity" ? "\u6E05\u6670" : "\u8FF7\u96FE"));
    lines.push("- \u6700\u7EC8\u8EAB\u4EFD\uFF1A" + game.players.map((p) => p.seat + "\u53F7 " + COUNCIL_ROLE_BY_ID[p.role].name).join("\uFF1B"));
  }
  lines.push("", "## \u516C\u5F00\u4E0E\u672C\u4EBA\u53EF\u89C1\u7684\u8BB0\u5F55", "");
  for (const event of fogCouncilVisibleEvents(game)) {
    lines.push("### " + (event.actorSeat ? event.actorSeat + "\u53F7" : "\u4E3B\u6301\u4EBA"), "", event.text, "");
  }
  return lines.join("\n").trimEnd() + "\n";
}
function exportFogCouncilGame(game) {
  const blob = new Blob([fogCouncilGameMarkdown(game)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "fog-council-" + game.round + ".md";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
async function deleteWerewolfGame(game) {
  if (game.status === "running" || game.status === "waiting_human" || game.pendingTurn) {
    showComposerError("\u8BF7\u5148\u4E2D\u65AD\u6B63\u5728\u8FD0\u884C\u7684\u72FC\u4EBA\u6740\u5BF9\u5C40");
    return;
  }
  if (!window.confirm(`\u5220\u9664\u72FC\u4EBA\u6740\u5BF9\u5C40\u201C${game.title}\u201D\uFF1F\u6B64\u64CD\u4F5C\u53EA\u5220\u9664\u6269\u5C55\u672C\u5730\u8BB0\u5F55\u3002`)) return;
  try {
    await runtimeMessage({ type: "DELETE_WEREWOLF_GAME", gameId: game.id });
    await refreshStateFromStorage();
    renderHistory();
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}
async function deleteFogCouncilGame(game) {
  if (game.status === "running" || game.pendingTurn) {
    showComposerError("\u8BF7\u5148\u4E2D\u65AD\u5E76\u786E\u8BA4\u672C\u5C40\u6CA1\u6709\u5F85\u5B8C\u6210\u7F51\u9875\u64CD\u4F5C");
    return;
  }
  if (!window.confirm("\u5220\u9664\u201C" + game.title + "\u201D\uFF1F\u6B64\u64CD\u4F5C\u53EA\u5220\u9664\u672C\u5730\u8BB0\u5F55\u3002")) return;
  try {
    await runtimeMessage({ type: "DELETE_FOG_COUNCIL_GAME", gameId: game.id });
    await refreshStateFromStorage();
    renderHistory();
  } catch (error) {
    showComposerError(error instanceof Error ? error.message : String(error));
  }
}
async function deleteSession(session) {
  if (session.execution?.status === "running") {
    showComposerError("\u8BF7\u5148\u4E2D\u65AD\u6B63\u5728\u8FD0\u884C\u7684\u4F1A\u8BDD");
    return;
  }
  if (!window.confirm(`\u5220\u9664\u4F1A\u8BDD\u201C${session.title}\u201D\uFF1F\u6B64\u64CD\u4F5C\u53EA\u5220\u9664\u6269\u5C55\u672C\u5730\u8BB0\u5F55\u3002`)) return;
  state.conversations = state.conversations.filter((item) => item.id !== session.id);
  if (state.activeConversationIds[session.mode] === session.id) createSession(session.mode);
  await saveState(state);
  renderHistory();
  renderMode();
}
function renderHistory() {
  const body = el("historyBody");
  body.replaceChildren();
  const modes = ["qa", "roundtable", "expert"];
  for (const mode of modes) {
    const section = document.createElement("section");
    section.className = "history-section";
    const heading2 = document.createElement("h3");
    heading2.textContent = modeLabel(mode);
    section.append(heading2);
    const sessions = [...state.conversations].filter((session) => session.mode === mode && session.messages.length).sort((a, b) => b.updatedAt - a.updatedAt);
    if (!sessions.length) {
      const empty = document.createElement("p");
      empty.className = "history-empty";
      empty.textContent = "\u6682\u65E0\u4F1A\u8BDD";
      section.append(empty);
    }
    for (const session of sessions) {
      const card = document.createElement("div");
      card.className = `history-card ${state.activeConversationIds[mode] === session.id ? "active" : ""}`;
      const title = document.createElement("button");
      title.type = "button";
      title.className = "history-title";
      title.textContent = session.title;
      title.addEventListener("click", async () => {
        state.activeMode = mode;
        state.activeConversationIds[mode] = session.id;
        el("historyOverlay").classList.add("hidden");
        clearComposer();
        renderMode();
        await saveState(state);
      });
      const exportButton = actionIconButton(ICON_EXPORT, "\u5BFC\u51FA\u4E3A Markdown");
      exportButton.addEventListener("click", () => exportSession(session));
      const deleteButton = actionIconButton(ICON_DELETE, "\u5220\u9664\u4F1A\u8BDD");
      deleteButton.addEventListener("click", () => void deleteSession(session));
      card.append(title, exportButton, deleteButton);
      section.append(card);
    }
    body.append(section);
  }
  const gameSection = document.createElement("section");
  gameSection.className = "history-section";
  const gameHeading = document.createElement("h3");
  gameHeading.textContent = "\u72FC\u4EBA\u6740";
  gameSection.append(gameHeading);
  const games = [...state.werewolfGames].sort((a, b) => b.updatedAt - a.updatedAt);
  if (!games.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "\u6682\u65E0\u5BF9\u5C40";
    gameSection.append(empty);
  }
  for (const game of games) {
    const card = document.createElement("div");
    card.className = `history-card ${state.activeWerewolfGameId === game.id ? "active" : ""}`;
    const title = document.createElement("button");
    title.type = "button";
    title.className = "history-title";
    title.textContent = `${game.title} \xB7 ${werewolfStatusLabel(game)}`;
    title.addEventListener("click", async () => {
      try {
        await runtimeMessage({ type: "SET_ACTIVE_WEREWOLF_GAME", gameId: game.id });
        state.activeMode = "werewolf";
        state.activeWerewolfGameId = game.id;
        el("historyOverlay").classList.add("hidden");
        clearComposer();
        renderMode();
        await saveState(state);
      } catch (error) {
        showComposerError(error instanceof Error ? error.message : String(error));
      }
    });
    const exportButton = actionIconButton(ICON_EXPORT, "\u5BFC\u51FA\u4E3A Markdown");
    exportButton.addEventListener("click", () => exportWerewolfGame(game));
    const deleteButton = actionIconButton(ICON_DELETE, "\u5220\u9664\u5BF9\u5C40");
    deleteButton.addEventListener("click", () => void deleteWerewolfGame(game));
    card.append(title, exportButton, deleteButton);
    gameSection.append(card);
  }
  body.append(gameSection);
  const councilSection = document.createElement("section");
  councilSection.className = "history-section";
  const councilHeading = document.createElement("h3");
  councilHeading.textContent = "AI \u8FF7\u96FE\u8BAE\u4F1A";
  councilSection.append(councilHeading);
  const councilGames = [...state.fogCouncilGames].sort((a, b) => b.updatedAt - a.updatedAt);
  if (!councilGames.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "\u6682\u65E0\u5BF9\u5C40";
    councilSection.append(empty);
  }
  for (const game of councilGames) {
    const card = document.createElement("div");
    card.className = "history-card " + (state.activeFogCouncilGameId === game.id ? "active" : "");
    const title = document.createElement("button");
    title.type = "button";
    title.className = "history-title";
    title.textContent = game.title + " \xB7 " + fogCouncilStatusLabel(game);
    title.addEventListener("click", async () => {
      try {
        await runtimeMessage({ type: "SET_ACTIVE_FOG_COUNCIL_GAME", gameId: game.id });
        state.activeMode = "fog_council";
        state.activeFogCouncilGameId = game.id;
        el("historyOverlay").classList.add("hidden");
        clearComposer();
        renderMode();
      } catch (error) {
        showComposerError(error instanceof Error ? error.message : String(error));
      }
    });
    const exportButton = actionIconButton(ICON_EXPORT, "\u5BFC\u51FA\u4E3A Markdown");
    exportButton.addEventListener("click", () => exportFogCouncilGame(game));
    const deleteButton = actionIconButton(ICON_DELETE, "\u5220\u9664\u5BF9\u5C40");
    deleteButton.addEventListener("click", () => void deleteFogCouncilGame(game));
    card.append(title, exportButton, deleteButton);
    councilSection.append(card);
  }
  body.append(councilSection);
}
async function newConversation() {
  const mode = state.activeMode;
  if (mode === "werewolf") {
    const game = activeWerewolfGame();
    if (game?.status === "running" || game?.status === "waiting_human") return showComposerError("\u8BF7\u5148\u4E2D\u65AD\u5F53\u524D\u72FC\u4EBA\u6740\u5BF9\u5C40\u518D\u65B0\u5F00\u4E00\u5C40");
    try {
      await runtimeMessage({ type: "SET_ACTIVE_WEREWOLF_GAME" });
      state.activeWerewolfGameId = void 0;
      clearComposer();
      renderMode();
    } catch (error) {
      showComposerError(error instanceof Error ? error.message : String(error));
    }
    return;
  }
  if (mode === "fog_council") {
    const game = activeFogCouncilGame();
    if (game?.status === "running") return showComposerError("\u8BF7\u5148\u4E2D\u65AD\u6B63\u5728\u8FDB\u884C\u7684\u8BAE\u4F1A");
    try {
      await runtimeMessage({ type: "SET_ACTIVE_FOG_COUNCIL_GAME" });
      state.activeFogCouncilGameId = void 0;
      clearComposer();
      renderMode();
    } catch (error) {
      showComposerError(error instanceof Error ? error.message : String(error));
    }
    return;
  }
  const current = activeSession();
  if (current.execution?.status === "running") return showComposerError("\u8BF7\u5148\u4E2D\u65AD\u5F53\u524D\u5FAA\u73AF\u518D\u65B0\u5EFA\u4F1A\u8BDD");
  createSession(mode);
  interruptRequested = false;
  clearComposer();
  renderMode();
  await saveState(state);
}
function openOverlay(idValue) {
  el(idValue).classList.remove("hidden");
}
function closeOverlay(idValue) {
  el(idValue).classList.add("hidden");
}
async function refreshStateFromStorage() {
  state = await loadState();
  uiBaseline = structuredClone(state);
  ensureActiveSession("qa");
  ensureActiveSession("roundtable");
  ensureActiveSession("expert");
  renderMode();
  if (!el("settingsOverlay").classList.contains("hidden")) renderSettings();
  if (!el("expertOverlay").classList.contains("hidden")) renderExpertPresets();
  if (!el("historyOverlay").classList.contains("hidden")) renderHistory();
}
function wireOverlay(overlayId, closeButtonId) {
  const overlay = el(overlayId);
  el(closeButtonId).addEventListener("click", () => closeOverlay(overlayId));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closeOverlay(overlayId);
  });
}
function wireEvents() {
  document.querySelectorAll(".mode-tab").forEach((tab) => tab.addEventListener("click", async () => {
    state.activeMode = tab.dataset.mode;
    if (isConversationMode(state.activeMode)) ensureActiveSession(state.activeMode);
    clearComposer();
    renderMode();
    await saveState(state);
  }));
  el("newConversationButton").addEventListener("click", () => void newConversation());
  el("fullscreenButton").addEventListener("click", () => void runtimeMessage({ type: "OPEN_FULLSCREEN" }));
  el("settingsButton").addEventListener("click", () => {
    renderSettings();
    openOverlay("settingsOverlay");
    void refreshProviderAvailability(PROVIDERS.map((provider) => provider.id));
  });
  el("expertPresetButton").addEventListener("click", () => {
    renderExpertPresets();
    openOverlay("expertOverlay");
  });
  el("historyButton").addEventListener("click", () => {
    renderHistory();
    openOverlay("historyOverlay");
  });
  el("fogCouncilScriptButton").addEventListener("click", () => {
    renderFogCouncilScript();
    openOverlay("fogCouncilScriptOverlay");
  });
  wireOverlay("settingsOverlay", "closeSettingsButton");
  wireOverlay("expertOverlay", "closeExpertButton");
  wireOverlay("historyOverlay", "closeHistoryButton");
  wireOverlay("fogCouncilScriptOverlay", "closeFogCouncilScriptButton");
  el("newExpertButton").addEventListener("click", () => openExpertEditor());
  el("saveExpertButton").addEventListener("click", () => void saveExpertPreset());
  el("cancelExpertButton").addEventListener("click", closeExpertEditor);
  const expertImportInput = el("expertImportInput");
  el("importExpertsButton").addEventListener("click", () => {
    expertImportInput.value = "";
    expertImportInput.click();
  });
  el("exportExpertsButton").addEventListener("click", exportExpertPresets);
  expertImportInput.addEventListener("change", () => {
    const file = expertImportInput.files?.[0];
    expertImportInput.value = "";
    if (file) void importExpertPresets(file);
  });
  el("attachButton").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files) void addFiles(fileInput.files);
  });
  messageInput.addEventListener("paste", (event) => {
    const files = [...event.clipboardData?.files ?? []];
    if (files.length) void addFiles(files);
  });
  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && state.activeMode === "qa") {
      event.preventDefault();
      void handleQaSend();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && state.activeMode === "werewolf" && humanTextTurn(activeWerewolfGame()?.pendingHumanAction)) {
      event.preventDefault();
      void handleWerewolfHumanTextSend();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey && state.activeMode === "fog_council" && fogCouncilHumanTextTurn(activeFogCouncilGame()?.pendingHumanAction)) {
      event.preventDefault();
      void handleFogCouncilHumanTextSend();
    }
  });
  qaSendButton.addEventListener("click", () => void handleQaSend());
  roundActionButton.addEventListener("click", () => void handleSequentialAction());
  el("werewolfActionButton").addEventListener("click", () => void handleWerewolfAction());
  el("werewolfHumanSendButton").addEventListener("click", () => void handleWerewolfHumanTextSend());
  el("fogCouncilActionButton").addEventListener("click", () => void handleFogCouncilAction());
  el("fogCouncilHumanSendButton").addEventListener("click", () => void handleFogCouncilHumanTextSend());
  roundRange.addEventListener("input", () => {
    const session = activeSession();
    if (!isSequentialMode(session.mode)) return;
    session.rounds = Number(roundRange.value);
    if (session.execution) session.execution.targetRounds = session.rounds;
    roundNumber.value = roundRange.value;
    touchSession(session);
    void saveState(state);
  });
  roundNumber.addEventListener("change", () => {
    const session = activeSession();
    if (!isSequentialMode(session.mode)) return;
    const value = Math.max(1, Math.min(99, Math.trunc(Number(roundNumber.value) || 1)));
    session.rounds = value;
    if (session.execution) session.execution.targetRounds = value;
    roundNumber.value = String(value);
    roundRange.value = String(Math.min(8, value));
    touchSession(session);
    void saveState(state);
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes[STORAGE_KEY]) void refreshStateFromStorage();
  });
}
async function init() {
  state = await loadState();
  uiBaseline = structuredClone(state);
  ensureActiveSession("qa");
  ensureActiveSession("roundtable");
  ensureActiveSession("expert");
  wireEvents();
  renderMode();
  renderSettings();
  renderExpertPresets();
  renderAttachmentTray();
  await saveState(state);
}
void init();
/*! Bundled license information:

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.16 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.16/LICENSE *)
  (*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE *)
*/
