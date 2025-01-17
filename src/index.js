import * as C from './constant';
import en from './locale/en';
import * as OriginalUtils from './utils';

const IS_DAYJS = '$isDayjsObject';

/**
 * Factory function to create a new DayjsInstance and return the dayjs function.
 */
function createDayJS() {
  const instance = new DayjsInstance();
  const dayjs = instance.dayjs.bind(instance);

  // Assign instance-specific methods to the dayjs function
  dayjs.extend = instance.extend.bind(instance);
  dayjs.locale = instance.locale.bind(instance);
  dayjs.isDayjs = instance.isDayjs.bind(instance);
  dayjs.unix = instance.unix.bind(instance);
  dayjs.setInvalidDateString = instance.setInvalidDateString.bind(instance);
  dayjs.locales = instance.locales;

  return dayjs;
}

/**
 * DayjsInstance Class: Manages instance-specific configurations and behaviors.
 */
class DayjsInstance {
  constructor() {
    // Instance-specific locale settings
    this._locale = 'en';
    this._loadedLocales = { en };
    // Track installed plugins per instance
    this._installedPlugins = new Set();
    // Clone utility functions to prevent shared state
    this._utils = { ...OriginalUtils };
    this._utils.l = this._parseLocale.bind(this);
    this._utils.i = this._isDayjs.bind(this);
    this._utils.w = this._wrapper.bind(this);
  }

  /**
   * Helper to check if an object is a Day.js instance.
   * @param {*} d 
   * @returns {boolean}
   */
  _isDayjs(d) {
    return d instanceof Dayjs || !!(d && d[IS_DAYJS]);
  }

  /**
   * Parses and sets the locale for the instance.
   * @param {string|object} preset 
   * @param {object} object 
   * @param {boolean} isLocal 
   * @returns {string|undefined}
   */
  _parseLocale(preset, object, isLocal) {
    let l;
    if (!preset) return this._locale;
    if (typeof preset === 'string') {
      const presetLower = preset.toLowerCase();
      if (this._loadedLocales[presetLower]) {
        l = presetLower;
      }
      if (object) {
        this._loadedLocales[presetLower] = object;
        l = presetLower;
      }
      const presetSplit = preset.split('-');
      if (!l && presetSplit.length > 1) {
        return this._parseLocale(presetSplit[0]);
      }
    } else {
      const { name } = preset;
      if (name) {
        this._loadedLocales[name] = preset;
        l = name;
      }
    }
    if (!isLocal && l) this._locale = l;
    return l || (!isLocal && this._locale);
  }

  /**
   * Wrapper function for creating Dayjs objects.
   * @param {Date|string|number} date 
   * @param {object} instance 
   * @returns {Dayjs}
   */
  _wrapper(date, instance) {
    return this.dayjs(date, {
      locale: instance.$L,
      utc: instance._u,
      x: instance._x,
      $offset: instance._offset, // TODO: Refactor to avoid using $offset directly
    });
  }

  /**
   * Main dayjs function to parse/create dates.
   * @param {Date|string|number|Dayjs} date 
   * @param {object} config 
   * @returns {Dayjs}
   */
  dayjs(date, config) {
    if (this._isDayjs(date)) {
      return date.clone();
    }
    return new Dayjs({ ...config, date, args: arguments }, this);
  }

  /**
   * Extends the instance with a plugin.
   * @param {function} plugin 
   * @param {object} option 
   * @returns {function} dayjs
   */
  extend(plugin, option) {
    if (typeof plugin !== 'function') {
      throw new TypeError('Plugin must be a function');
    }
    if (!this._installedPlugins.has(plugin)) {
      try {
        plugin(option, Dayjs, this.dayjs.bind(this));
        this._installedPlugins.add(plugin);
      } catch (error) {
        console.error(`Failed to extend Dayjs instance with plugin: ${error.message}`);
      }
    }
    return this.dayjs.bind(this);
  }

  /**
   * Sets or gets the locale for the instance.
   * @param {string|object} preset 
   * @param {object} object 
   * @returns {function} dayjs
   */
  locale(preset, object) {
    if (!preset) return this._locale;
    const newLocale = this._parseLocale(preset, object, true);
    if (newLocale) this._locale = newLocale;
    return this.dayjs.bind(this);
  }

  /**
   * Checks if an object is a Day.js instance.
   * @param {*} d 
   * @returns {boolean}
   */
  isDayjs(d) {
    return this._isDayjs(d);
  }

  /**
   * Creates a Day.js object from a Unix timestamp.
   * @param {number} timestamp 
   * @returns {Dayjs}
   */
  unix(timestamp) {
    return this.dayjs(timestamp * 1e3);
  }

  /**
   * Retrieves all loaded locales for the instance.
   * @returns {object}
   */
  get locales() {
    return this._loadedLocales;
  }

  /**
   * Sets the invalid date string for the instance.
   * @param {string} str 
   * @returns {function} dayjs
   */
  setInvalidDateString(str) {
    C.INVALID_DATE_STRING = str;
    return this.dayjs.bind(this);
  }
}

/**
 * Dayjs Class: Represents a date object with various methods.
 */
class Dayjs {
  constructor(cfg, parentInstance) {
    this.parentInstance = parentInstance;
    this.$L = cfg.locale || parentInstance._locale;
    this.parse(cfg);
    this.$x = cfg.x || parentInstance._x || {};
    this[IS_DAYJS] = true;
  }

  /**
   * Parses the date configuration.
   * @param {object} cfg 
   */
  parse(cfg) {
    this.$d = parseDate(cfg);
    this.init();
  }

  /**
   * Initializes the date components.
   */
  init() {
    const { $d } = this;
    this.$y = $d.getFullYear();
    this.$M = $d.getMonth();
    this.$D = $d.getDate();
    this.$W = $d.getDay();
    this.$H = $d.getHours();
    this.$m = $d.getMinutes();
    this.$s = $d.getSeconds();
    this.$ms = $d.getMilliseconds();
  }

  /**
   * Retrieves utility functions.
   * @returns {object}
   */
  $utils() {
    return this.parentInstance._utils;
  }

  /**
   * Checks if the date is valid.
   * @returns {boolean}
   */
  isValid() {
    return !(this.$d.toString() === C.INVALID_DATE_STRING);
  }

  /**
   * Checks if two dates are the same based on units.
   * @param {Dayjs|string|Date} that 
   * @param {string} units 
   * @returns {boolean}
   */
  isSame(that, units) {
    const other = this.parentInstance.dayjs(that);
    return this.startOf(units) <= other && other <= this.endOf(units);
  }

  /**
   * Checks if the current date is after the given date.
   * @param {Dayjs|string|Date} that 
   * @param {string} units 
   * @returns {boolean}
   */
  isAfter(that, units) {
    return this.parentInstance.dayjs(that) < this.startOf(units);
  }

  /**
   * Checks if the current date is before the given date.
   * @param {Dayjs|string|Date} that 
   * @param {string} units 
   * @returns {boolean}
   */
  isBefore(that, units) {
    return this.endOf(units) < this.parentInstance.dayjs(that);
  }

  /**
   * Internal getter/setter.
   * @param {*} input 
   * @param {string} get 
   * @param {string} set 
   * @returns {*}
   */
  $g(input, get, set) {
    if (this.$utils().u(input)) return this[get];
    return this.set(set, input);
  }

  /**
   * Converts the date to Unix timestamp.
   * @returns {number}
   */
  unix() {
    return Math.floor(this.valueOf() / 1000);
  }

  /**
   * Retrieves the timestamp value.
   * @returns {number}
   */
  valueOf() {
    return this.$d.getTime();
  }

  /**
   * Sets the start of a unit.
   * @param {string} units 
   * @param {boolean} startOf 
   * @returns {Dayjs}
   */
  startOf(units, startOf) {
    const isStartOf = !this.$utils().u(startOf) ? startOf : true;
    const unit = this.$utils().p(units);
    const instanceFactory = (d, m) => {
      const ins = this.$utils().w(this.parentInstance._u ?
        Date.UTC(this.$y, m, d) : new Date(this.$y, m, d), this);
      return isStartOf ? ins : ins.endOf(C.D);
    };
    const instanceFactorySet = (method, slice) => {
      const argumentStart = [0, 0, 0, 0];
      const argumentEnd = [23, 59, 59, 999];
      return this.$utils().w(this.toDate()[method].apply(
        this.toDate('s'),
        (isStartOf ? argumentStart : argumentEnd).slice(slice)
      ), this);
    };
    const { $W, $M, $D } = this;
    const utcPad = `set${this.parentInstance._u ? 'UTC' : ''}`;
    switch (unit) {
      case C.Y:
        return isStartOf ? instanceFactory(1, 0) :
          instanceFactory(31, 11);
      case C.M:
        return isStartOf ? instanceFactory(1, $M) :
          instanceFactory(0, $M + 1);
      case C.W: {
        const weekStart = this.$locale().weekStart || 0;
        const gap = ($W < weekStart ? $W + 7 : $W) - weekStart;
        return instanceFactory(isStartOf ? $D - gap : $D + (6 - gap), $M);
      }
      case C.D:
      case C.DATE:
        return instanceFactorySet(`${utcPad}Hours`, 0);
      case C.H:
        return instanceFactorySet(`${utcPad}Minutes`, 1);
      case C.MIN:
        return instanceFactorySet(`${utcPad}Seconds`, 2);
      case C.S:
        return instanceFactorySet(`${utcPad}Milliseconds`, 3);
      default:
        return this.clone();
    }
  }

  /**
   * Sets the end of a unit.
   * @param {string} arg 
   * @returns {Dayjs}
   */
  endOf(arg) {
    return this.startOf(arg, false);
  }

  /**
   * Internal setter for units.
   * @param {string} units 
   * @param {number} int 
   * @returns {Dayjs}
   */
  $set(units, int) {
    const unit = this.$utils().p(units);
    const utcPad = `set${this.parentInstance._u ? 'UTC' : ''}`;
    const name = {
      [C.D]: `${utcPad}Date`,
      [C.DATE]: `${utcPad}Date`,
      [C.M]: `${utcPad}Month`,
      [C.Y]: `${utcPad}FullYear`,
      [C.H]: `${utcPad}Hours`,
      [C.MIN]: `${utcPad}Minutes`,
      [C.S]: `${utcPad}Seconds`,
      [C.MS]: `${utcPad}Milliseconds`
    }[unit];
    const arg = unit === C.D ? this.$D + (int - this.$W) : int;

    if (unit === C.M || unit === C.Y) {
      const date = this.clone().set(C.DATE, 1);
      date.$d[name](arg);
      date.init();
      this.$d = date.set(C.DATE, Math.min(this.$D, date.daysInMonth())).$d;
    } else if (name) {
      this.$d[name](arg);
    }

    this.init();
    return this;
  }

  /**
   * Sets a specific unit to a value.
   * @param {string} string 
   * @param {number} int 
   * @returns {Dayjs}
   */
  set(string, int) {
    return this.clone().$set(string, int);
  }

  /**
   * Retrieves a specific unit's value.
   * @param {string} unit 
   * @returns {*}
   */
  get(unit) {
    return this.$utils().p(unit);
  }

  /**
   * Adds time to the current date.
   * @param {number} number 
   * @param {string} units 
   * @returns {Dayjs}
   */
  add(number, units) {
    number = Number(number);
    const unit = this.$utils().p(units);
    const instanceFactorySet = (n) => {
      const d = this.parentInstance.dayjs(this);
      return this.$utils().w(d.date(d.date() + Math.round(n * number)), this);
    };
    if (unit === C.M) {
      return this.set(C.M, this.$M + number);
    }
    if (unit === C.Y) {
      return this.set(C.Y, this.$y + number);
    }
    if (unit === C.D) {
      return instanceFactorySet(1);
    }
    if (unit === C.W) {
      return instanceFactorySet(7);
    }
    const step = {
      [C.MIN]: C.MILLISECONDS_A_MINUTE,
      [C.H]: C.MILLISECONDS_A_HOUR,
      [C.S]: C.MILLISECONDS_A_SECOND
    }[unit] || 1; // ms

    const nextTimeStamp = this.$d.getTime() + (number * step);
    return this.$utils().w(nextTimeStamp, this);
  }

  /**
   * Subtracts time from the current date.
   * @param {number} number 
   * @param {string} string 
   * @returns {Dayjs}
   */
  subtract(number, string) {
    return this.add(number * -1, string);
  }

  /**
   * Formats the date according to the provided format string.
   * @param {string} formatStr 
   * @returns {string}
   */
  format(formatStr) {
    const locale = this.$locale();

    if (!this.isValid()) return locale.invalidDate || C.INVALID_DATE_STRING;

    const str = formatStr || C.FORMAT_DEFAULT;
    const zoneStr = this.$utils().z(this);
    const { $H, $m, $M } = this;
    const {
      weekdays, months, meridiem
    } = locale;
    const getShort = (arr, index, full, length) => (
      (arr && (arr[index] || arr(this, str))) || full[index].slice(0, length)
    );
    const get$H = num => (
      this.$utils().s($H % 12 || 12, num, '0')
    );

    const meridiemFunc = meridiem || ((hour, minute, isLowercase) => {
      const m = (hour < 12 ? 'AM' : 'PM');
      return isLowercase ? m.toLowerCase() : m;
    });

    const matches = (match) => {
      switch (match) {
        case 'YY':
          return String(this.$y).slice(-2);
        case 'YYYY':
          return this.$utils().s(this.$y, 4, '0');
        case 'M':
          return $M + 1;
        case 'MM':
          return this.$utils().s($M + 1, 2, '0');
        case 'MMM':
          return getShort(locale.monthsShort, $M, months, 3);
        case 'MMMM':
          return getShort(months, $M);
        case 'D':
          return this.$D;
        case 'DD':
          return this.$utils().s(this.$D, 2, '0');
        case 'd':
          return String(this.$W);
        case 'dd':
          return getShort(locale.weekdaysMin, this.$W, weekdays, 2);
        case 'ddd':
          return getShort(locale.weekdaysShort, this.$W, weekdays, 3);
        case 'dddd':
          return weekdays[this.$W];
        case 'H':
          return String($H);
        case 'HH':
          return this.$utils().s($H, 2, '0');
        case 'h':
          return get$H(1);
        case 'hh':
          return get$H(2);
        case 'a':
          return meridiemFunc($H, $m, true);
        case 'A':
          return meridiemFunc($H, $m, false);
        case 'm':
          return String($m);
        case 'mm':
          return this.$utils().s($m, 2, '0');
        case 's':
          return String(this.$s);
        case 'ss':
          return this.$utils().s(this.$s, 2, '0');
        case 'SSS':
          return this.$utils().s(this.$ms, 3, '0');
        case 'Z':
          return zoneStr; // 'ZZ' logic below
        default:
          break;
      }
      return null;
    };

    return str.replace(C.REGEX_FORMAT, (match, $1) => $1 || matches(match) || zoneStr.replace(':', '')); // 'ZZ'
  }

  /**
   * Retrieves the UTC offset.
   * @returns {number}
   */
  utcOffset() {
    return -Math.round(this.$d.getTimezoneOffset() / 15) * 15;
  }

  /**
   * Calculates the difference between two dates.
   * @param {Dayjs|string|Date} input 
   * @param {string} units 
   * @param {boolean} float 
   * @returns {number}
   */
  diff(input, units, float) {
    const unit = this.$utils().p(units);
    const that = this.parentInstance.dayjs(input);
    const zoneDelta = (that.utcOffset() - this.utcOffset()) * C.MILLISECONDS_A_MINUTE;
    const diff = this - that;
    const getMonth = () => this.$utils().m(this, that);

    let result;
    switch (unit) {
      case C.Y:
        result = getMonth() / 12;
        break;
      case C.M:
        result = getMonth();
        break;
      case C.Q:
        result = getMonth() / 3;
        break;
      case C.W:
        result = (diff - zoneDelta) / C.MILLISECONDS_A_WEEK;
        break;
      case C.D:
        result = (diff - zoneDelta) / C.MILLISECONDS_A_DAY;
        break;
      case C.H:
        result = diff / C.MILLISECONDS_A_HOUR;
        break;
      case C.MIN:
        result = diff / C.MILLISECONDS_A_MINUTE;
        break;
      case C.S:
        result = diff / C.MILLISECONDS_A_SECOND;
        break;
      default:
        result = diff; // milliseconds
        break;
    }

    return float ? result : this.$utils().a(result);
  }

  /**
   * Retrieves the number of days in the current month.
   * @returns {number}
   */
  daysInMonth() {
    return this.endOf(C.M).$D;
  }

  /**
   * Retrieves the locale object.
   * @returns {object}
   */
  $locale() {
    return this.parentInstance._loadedLocales[this.$L];
  }

  /**
   * Sets or gets the locale for the date object.
   * @param {string|object} preset 
   * @param {object} object 
   * @returns {Dayjs}
   */
  locale(preset, object) {
    if (!preset) return this.$L;
    const that = this.clone();
    const nextLocaleName = this.parentInstance._parseLocale(preset, object, true);
    if (nextLocaleName) that.$L = nextLocaleName;
    return that;
  }

  /**
   * Clones the current Dayjs object.
   * @returns {Dayjs}
   */
  clone() {
    return this.parentInstance._wrapper(this.$d, this);
  }

  /**
   * Converts the Dayjs object to a native Date object.
   * @returns {Date}
   */
  toDate() {
    return new Date(this.valueOf());
  }

  /**
   * Converts the Dayjs object to JSON.
   * @returns {string|null}
   */
  toJSON() {
    return this.isValid() ? this.toISOString() : null;
  }

  /**
   * Converts the Dayjs object to an ISO string.
   * @returns {string}
   */
  toISOString() {
    return this.$d.toISOString();
  }

  /**
   * Converts the Dayjs object to a UTC string.
   * @returns {string}
   */
  toString() {
    return this.$d.toUTCString();
  }

  /**
   * Creates a new Dayjs instance from the current object.
   * @returns {function} New dayjs function bound to a fresh instance.
   */
  instance() {
    return createDayJS();
  }
}

/**
 * Parses the date configuration into a native Date object.
 * @param {object} cfg 
 * @returns {Date}
 */
function parseDate(cfg) {
  const { date, utc } = cfg;
  if (date === null) return new Date(NaN); // null is invalid
  if (OriginalUtils.u(date)) return new Date(); // today
  if (date instanceof Date) return new Date(date);
  if (typeof date === 'string' && !/Z$/i.test(date)) {
    const d = date.match(C.REGEX_PARSE);
    if (d) {
      const m = d[2] - 1 || 0;
      const ms = (d[7] || '0').substring(0, 3);
      if (utc) {
        return new Date(Date.UTC(d[1], m, d[3] || 1, d[4] || 0, d[5] || 0, d[6] || 0, ms));
      }
      return new Date(d[1], m, d[3] || 1, d[4] || 0, d[5] || 0, d[6] || 0, ms);
    }
  }
  return new Date(date); // everything else
}

// Create and export the default singleton instance
const defaultInstance = createDayJS();
export default defaultInstance;
export { createDayJS };
