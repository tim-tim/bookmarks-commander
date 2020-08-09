'use strict';

const bookmarks = {
  rootID: typeof InstallTrigger !== 'undefined' ? 'root________' : '0',
  isRoot(id) {
    return id === '' || id === bookmarks.rootID;
  },
  isSearch(id) {
    return Boolean(id.query);
  },
  parent(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.get(id, arr => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(lastError);
        }
        else {
          resolve(arr[0]);
        }
      });
    });
  },
  children(id) {
    // duplicate finder
    if (id.query && id.query.startsWith('duplicates')) {
      let openerId = id.query.replace('duplicates:', '') || bookmarks.rootID;
      openerId = isNaN(openerId) ? bookmarks.rootID : openerId;
      return new Promise(resolve => chrome.bookmarks.getSubTree(openerId, children => {
        const links = {};
        const swipe = (root, path = '.') => {
          for (const node of root.children) {
            if ('children' in node) {
              swipe(node, path + '/' + (node.title || ''));
            }
            else if (node.url) {
              links[node.url] = links[node.url] || [];
              node.relativePath = path.replace('.//', '/');
              links[node.url].push(node);
            }
          }
        };
        swipe({
          children
        });
        return resolve(Object.values(links).filter(nodes => nodes.length > 1).flat());
      }));
    }
    else if (id.query) {
      return new Promise(resolve => chrome.bookmarks.search({
        query: id.query
      }, nodes => {
        resolve(nodes);
      }));
    }
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(id, nodes => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(lastError);
        }
        else {
          // You cannot use this API to add or remove entries in the root folder.
          if (id === '' || id === bookmarks.rootID) {
            nodes.forEach(n => n.readonly = true);
          }
          resolve(nodes);
        }
      });
    });
  },
  update(id, o) {
    return new Promise((resolve, reject) => chrome.bookmarks.update(id, o, nodes => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(lastError);
      }
      else {
        resolve(nodes);
      }
    }));
  },
  move(id, o) {
    return new Promise((resolve, reject) => chrome.bookmarks.move(id, o, node => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(lastError);
      }
      else {
        resolve(node);
      }
    }));
  },
  create(o) {
    return new Promise((resolve, reject) => chrome.bookmarks.create(o, node => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(lastError);
      }
      else {
        resolve(node);
      }
    }));
  },
  remove(id, recursive = false) {
    return new Promise((resolve, reject) => chrome.bookmarks[recursive ? 'removeTree' : 'remove'](id, () => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(lastError);
      }
      else {
        resolve();
      }
    }));
  }
};

const tabs = {
  create(o) {
    return new Promise(resolve => chrome.tabs.create(o, resolve));
  },
  update(id, o) {
    return new Promise(resolve => chrome.tabs.update(id, o, resolve));
  },
  active() {
    return new Promise((resolve, reject) => chrome.tabs.query({
      active: true,
      windowType: 'normal'
    }, tabs => tabs.length ? resolve(tabs[0]) : reject(Error('no active tab'))));
  }
};

const storage = {
  get(o) {
    return new Promise(resolve => chrome.storage.local.get(o, resolve));
  },
  set(o) {
    return new Promise(resolve => chrome.storage.local.set(o, resolve));
  },
  changed(callback) {
    chrome.storage.onChanged.addListener(callback);
  }
};

const ue = document.querySelector('prompt-view');
const user = {
  ask(msg, value) {
    return ue.ask(msg, value);
  },
  on(name, callback) {
    ue.on(name, callback);
  }
};

window.engine = {
  bookmarks,
  tabs,
  storage,
  user,
  notify(e) {
    if (e === 'beep') {
      return (new Audio('/data/assets/bell.wav')).play();
    }
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/data/icons/48.png',
      title: chrome.runtime.getManifest().name,
      message: e.message || e
    });
  },
  clipboard: {
    copy(str) {
      return navigator.clipboard.writeText(str).catch(() => new Promise(resolve => {
        document.oncopy = e => {
          e.clipboardData.setData('text/plain', str);
          e.preventDefault();
          resolve();
        };
        document.execCommand('Copy', false, null);
      }));
    }
  }
};

// single window
chrome.runtime.connect({
  name: 'instance'
});
