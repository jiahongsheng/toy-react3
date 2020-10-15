const RENDER_TO_DOM =Symbol("render to dom");

function replaceContent(range, node) {
  range.insertNode(node);
  range.setStartAfter(node);
  range.deleteContents();

  range.setStartBefore(node);
  range.setEndAfter(node);
}
export class Component {
  constructor() {
      this._root = null;
      this.children = [];
      this.props = Object.create(null);
      this._range = null;
  }
  setAttribute(name, value) {
      this.props[name] = value;
  }
  appendChild(component) {
      this.children.push(component);
  }
  get vdom() {
      return this.render().vdom;
  }
  [RENDER_TO_DOM](range) {
      this._range = range;
      this._vdom = this.vdom;
      this.render()[RENDER_TO_DOM](range);
  }
  update() {
      let isSameNode = (oldNode, newNode) => {
          if(oldNode.type !== newNode.type) return false;
          for(let name in newNode.props) {
              if(oldNode.props[name] !== newNode.props[name]) return false
          }
          if(Object.keys(oldNode.props).length >  Object.keys(newNode.props).length) return false;
          if(newNode.type === '#text' && newNode.content !== oldNode.content) return false;
          return true;
      }
      let updateNode = (oldNode, newNode) => {
          // type不同整个替换
          // props不一样，整个替换（实际可打patch）
          // #text的content 和 props逻辑一致
          if(!isSameNode(oldNode, newNode)) {
              newNode[RENDER_TO_DOM](oldNode._range);
              return;
          }
          newNode._range = oldNode._range;

          let newChildren = newNode.vchildren;
          let oldChildren = oldNode.vchildren;

          if(!oldChildren) return;
          let tailRange = oldChildren[oldChildren.length -1]._range;
          for(let i = 0; i < newChildren.length; i++) {
              let oldChild = oldChildren[i];
              let newChild = newChildren[i];
              if(i < oldChildren.length) {
                  updateNode(oldChild, newChild);
              } else {
                  let range = document.createRange();
                  range.setStart(tailRange.endContainer, tailRange.endOffset);
                  range.setEnd(tailRange.endContainer, tailRange.endOffset);
                  newChild[RENDER_TO_DOM](range);
                  tailRange = range;
              }
              
          }
      }
      let vdom = this.vdom;
      updateDom(this._vdom, this.vdom);
      this._vdom = vdom;
  }
  rerender() {
      let oldRange = this._range;

      let range = document.createRange();
      range.setStart(oldRange.startContainer, oldRange.startOffset);
      range.setEnd(oldRange.startContainer, oldRange.startOffset);
      this[RENDER_TO_DOM](range);

      oldRange.setStart(range.endContainer, range.endOffset);
      oldRange.deleteContents()
  }
  setState(newState) {
      if(this.state === null || typeof this.state !== 'object') {
          this.state = newState;
          this.rerender();
          return;
      }
      let combime = (oldState, newState) => {
          for(let key in newState) {
              if(oldState[key] === null || typeof oldState[key] !== 'object') {
                  oldState[key] = newState[key];
              } else {
                  combime(oldState[key], newState[key]);
              }
          }
      }
      combime(this.state, newState);
      this.rerender();
  }
}

class ElementWrapper extends Component {
  constructor(type) {
      super(type);
      this.type = type;
      this._range = null;
      this.root = document.createElement(type);
  }
  get vdom() {
      return this;
  }
  get vchildren() {
      return this.children.map(child => child.vdom);
  }
  [RENDER_TO_DOM](range) {
      this._range = range;

      let root = document.createElement(this.type);
      for(let name in this.props) {
          let value = this.props[name];
          if(name.match(/on([\s\S]+)$/)) {
              typeof name === 'string' && root.addEventListener(RegExp.$1.replace(/^[\s\S]/, c => c.toLowerCase()), value);
          } else {
              if(name === "className") {
                  name = "class";
              }
              root.setAttribute(name, value);
          }
      }
      for(let child of this.children) {
          let childRange = document.createRange();
          childRange.setStart(root, root.childNodes.length);
          childRange.setEnd(root, root.childNodes.length);
          child[RENDER_TO_DOM](childRange);
      }
      replaceContent(range, root);
  }
}

class TextWrapper extends Component {
  constructor(text) {
      super(text);
      this.type = "#text";
      this._range = null;
      this.content = text;
  }
  get vdom() {
      return this;
  }
  [RENDER_TO_DOM](range) {
      this._range = range;
      let root = document.createTextNode(this.content);
      replaceContent(range, root);
  }
}

export function createElement(type, attributes, ...children) {
  let element;
  if(typeof type === 'string') {
      element = new ElementWrapper(type);
  } else {
      element = new type;
  }
  for(let props in attributes) {
      element.setAttribute(props, attributes[props]);
  }
  let insertChildren = (children) => {
      for(let child of children) {
          if(typeof child === 'function') {
              throw(new Error('Functions are not valid as a React child'));
          }
          if(typeof child === 'string' || typeof child === 'number') {
              child = new TextWrapper(child);
          }
          if(child === null) {
              continue;
          }
          if(typeof child === 'object' && child instanceof Array) {
              insertChildren(child);
          } else {
              element.appendChild(child);
          }
      }
  }
  insertChildren(children);
  return element;
}

export function render(component, parentComponent) {
  let range = document.createRange();
  range.setStart(parentComponent, 0);
  range.setEnd(parentComponent, parentComponent.childNodes.length);
  range.deleteContents();
  component[RENDER_TO_DOM](range);
}
