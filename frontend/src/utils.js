import React, { useState, useEffect } from 'react';

export default {
  Limiter: (n, list) => {
    if (!list || !list.length) {
      return;
    }

    var tail = list.splice(n);
    var head = list;
    var resolved = [];
    var processed = 0;

    return new Promise(function (resolve) {
      head.forEach(function (x) {
        var res = x();
        resolved.push(res);
        res.then(function (y) {
          runNext();
          return y;
        });
      });
      function runNext() {
        if (processed == tail.length) {
          resolve(Promise.all(resolved));
        } else {
          resolved.push(
            tail[processed]().then(function (x) {
              runNext();
              return x;
            })
          );
          processed++;
        }
      }
    });
  },
};

// Custom debounce hook
export function useDebounce(value, delay = 500, callback = null) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
      if (callback) {
        callback();
      }
    }, delay);

    return () => clearTimeout(handler); // Cleanup timeout on unmount or value change
  }, [value, delay]);

  return debouncedValue;
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export const getDescendantProp = (obj, path) =>
  path.split('.').reduce((acc, part) => acc && acc[part], obj);

export const copyToClipboard = async (value) => {
  let copied = false;
  if (navigator.clipboard) {
    // Modern method, using navigator.clipboard
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  }

  if (!copied) {
    // Fallback method for environments without clipboard support
    const textarea = document.createElement('textarea');
    textarea.value = value;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
};
