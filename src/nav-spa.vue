<template>
    <component v-bind:is="tag" class="nav-spa" ref="nav-spa">
        <slot></slot>
    </component>
</template>

<script>
  import bezierEasing from 'bezier-easing'

  export default {
    name: 'nav-spa',
    props: {
      /**
       * CSS class displayed at the active link.
       *
       * @type {String}
       * @default active
       */
      activeClass: {
        type: String,
        default: 'active'
      },

      /**
       * Defines if the plugin should track the section change when clicking an item to scroll to
       * its section. If set to true, it will always keep track and change the active class to the
       * current section while scrolling, if false, the active class will be immediately applied to
       * the clicked menu item, ignoring the passed sections until the scrolling is over.
       *
       * @type {Boolean}
       * @default false
       */
      alwaysTrack: {
        type: Boolean,
        default: false,
      },

      /**
       * Your custom easing value for the click to scroll functionality.
       * It must be a string with 4 values separated by commas in a cubic bezier format.
       *
       * @type {String}
       * @default '.5,0,.35,1'
       */
      bezierEasingValue: {
        type: String,
        default: '.5,0,.35,1',
      },


      /**
       * Duration of the scroll animation.
       *
       * @type {Number}
       * @default 500
       */
      duration: {
        type: Number,
        default: 500
      },

      /**
       * Whether is event handler for click event enabled.
       *
       * @type {Boolean}
       * @default true
       */
      enabled: {
        type: Boolean,
        default: true
      },

      /**
       * Selector for links which be observed for the click event.
       *
       * @type {String}
       * @default a
       */
      link: {
        type: String,
        default: 'a[href^="#"]'
      },

      /**
       * Space between top of the window and the section.
       * This is usually set to your fixed header height.
       *
       * @type {Number}
       * @default 0
       */
      offset: {
        type: Number,
        default: 0
      },

      /**
       * Container of the sections, if omitted window will be used.
       * This value should be valid DOM selector.
       *
       * @type String
       * @default null
       */
      scrollContainer: {
        type: String,
        default: null
      },

      /**
       * Specify method which will be used for replacing history state.
       * If this method is not supported, in history API, the fallback
       * will be window.location.hash
       *
       * @type String either replaceState or pushState.
       * @default pushState
       */
      pushMethod: {
        type: String,
        default: 'pushState',
        validator: (val) => ['pushState', 'replaceState'].includes(val)
      },

      /**
       * Component tag, where will be the component rendered.
       *
       * @type {String}
       * @default nav
       */
      tag: {
        type: String,
        default: 'nav'
      },

      /**
       * Update hash in URL when section is changed.
       *
       * @type Boolean
       * @default true
       */
      updateHash: {
        type: Boolean,
        default: true
      }
    },

    data () {
      return {
        observer: null,
        items: [],
        currentItem: null,
        lastItem: null,
        scrollAnimationFrame: null,
        bezierEasing
      }
    },

    computed: {

      /**
       * Computes the bezier easing string value into an array.
       *
       * @return {Array.<string>}
       */
      cubicBezierArray () {
        return this.bezierEasingValue.split(',')
      },

      /**
       * Return container for the scroll content.
       *
       * @return {Object} HTML node of the container
       */
      getScrollContainer () {
        let container = window

        if (this.scrollContainer) {
          container = document.querySelector(this.scrollContainer) || window
        }

        return container
      }
    },

    mounted () {
      this.initObserver()
      this.initItems()
      this.removeActiveClass()
      this.currentItem = this.getItemInsideWindow()
      if (this.currentItem) this.currentItem.classList.add(this.activeClass)
      this.scrollToHashElement()
      this.getScrollContainer.addEventListener('scroll', this.onScroll)
    },

    updated() {
      this.initItems()
    },

    beforeDestroy() {
      this.getScrollContainer.removeEventListener('scroll', this.onScroll)
      window.cancelAnimationFrame(this.scrollAnimationFrame)
    },

    methods: {

      /**
       * Gets the item that corresponds to the current section inside the window
       *
       * @return {Element} Current element.
       */
      getItemInsideWindow() {
        let currentItem
        // Must be called with 'call' to prevent bugs on some devices
        [].forEach.call(this.items, (item) => {
          const isFirstItem = (item === this.items[0])
          const target = document.getElementById(decodeURI(item.hash.substr(1)))
          if (!target) return
          const distanceFromTop = this.getScrollContainer.scrollTop || window.pageYOffset
          const isScreenPastSection = distanceFromTop >= this.getOffsetTop(target) - this.offset
          const isScreenBeforeSectionEnd = distanceFromTop
            < (this.getOffsetTop(target) - this.offset) + target.offsetHeight
          if (isFirstItem && this.highlightFirstItem) {
            if (isScreenBeforeSectionEnd) currentItem = item
          }
          if (this.exact && isScreenPastSection && isScreenBeforeSectionEnd) currentItem = item
          if (!this.exact && isScreenPastSection) currentItem = item
        })
        return currentItem
      },

      /**
       * Gets the top offset position of an element in the document.
       *
       * @param {Element} element
       * @return {Number}
       */
      getOffsetTop (element) {
        let yPosition = 0
        let nextElement = element
        while (nextElement) {
          yPosition += (nextElement.offsetTop)
          nextElement = nextElement.offsetParent
        }

        if (this.getScrollContainer.offsetTop) {
          yPosition -= this.getScrollContainer.offsetTop
        }

        return yPosition
      },


      handleClick(event) {

        const { hash } = event.currentTarget
        const target = document.getElementById(decodeURI(hash.substr(1)))

        // if target is not located in this document, we continue normally
        if (!target) {
          return
        }

        event.preventDefault()

        /*  Temporarily removes the scroll listener and the request animation frame so the active
         *  class will only be applied to the clicked element, and not all elements while the window
         *  is scrolling.
         */
        if (!this.alwaysTrack) {
          this.getScrollContainer.removeEventListener('scroll', this.onScroll)
          window.cancelAnimationFrame(this.scrollAnimationFrame)
          this.removeActiveClass()
          event.currentTarget.classList.add(this.activeClass)
        }

        this.scrollTo(target).then(() => {

          if (!this.alwaysTrack) {
            this.getScrollContainer.addEventListener('scroll', this.onScroll)
            const findClickedItem = item => decodeURI(item.hash.substr(1)) === target.id
            this.currentItem = [].find.call(this.items, findClickedItem)

            if (this.currentItem !== this.lastActiveItem) {
              this.$emit('itemChanged', null, this.currentItem, this.lastActiveItem)
              this.lastActiveItem = this.currentItem
            }
          }

          if (this.updateHash) {
            this.pushHashToUrl(hash)
          }
        })

      },

      /**
       * Init mutation observe
       */
      initObserver() {
        const MutationObserver = window.MutationObserver || window.WebKitMutationObserver

        if (!this.observer) {
          this.observer = new MutationObserver(this.initItems)
          this.observer.observe(this.$el, {
            childList: true,
            subtree: true,
          })

        }
      },

      /**
       * Attach event listeners to items if component is enabled or remove
       * event listener from items if component is disabled.
       */
      initItems() {

        this.items = document.body.querySelectorAll(this.link)

        if (this.enabled) {
          // Must be called with 'call' to prevent bugs on some devices
          [].forEach.call(this.items, (item) => {
            item.addEventListener('click', this.handleClick)
          })
          return
        }
        // Must be called with 'call' to prevent bugs on some devices
        [].forEach.call(this.items, (item) => {
          item.removeEventListener('click', this.handleClick)
        })
      },


      onScroll (event) {
        this.currentItem = this.getItemInsideWindow()
        if (this.currentItem !== this.lastActiveItem) {
          this.removeActiveClass()
          this.$emit('itemChanged', event, this.currentItem, this.lastActiveItem)
          this.lastActiveItem = this.currentItem
        }
        // Current item might be null if not inside any section
        if (this.currentItem) this.currentItem.classList.add(this.activeClass)
      },

      /**
       * Pushes the given hash to the URL using primarily pushState/replaceState if available to prevent the
       * scroll from jumping to the hash element. Uses window.location.hash as a fallback.
       *
       * @param {String} hash The hash value to be pushed
       */
      pushHashToUrl(hash) {
        if (window.history.pushState || window.history.replaceState) {
          if (this.pushMethod === 'pushState') {
            window.history.pushState(null, null, hash)
          } else {
            window.history.replaceState(null, null, hash)
          }

          return
        }
        window.location.hash = hash
      },

      /**
       * Removes the active class from all items.
       */
      removeActiveClass() {
        // Must be called with 'call' to prevent bugs on some devices
        [].forEach.call(this.items, (item) => {
          item.classList.remove(this.activeClass)
        })
      },

      /**
       * Scrolls the page to the given target element.
       *
       * @param {Element} target DOM Element to scroll to.
       * @return {Promise} Returns a promise that will resolve when the animation is done.
       */
      scrollTo(target) {
        return new Promise((resolve) => {
          const targetDistanceFromTop = this.getOffsetTop(target)
          const startingY = this.getScrollContainer.scrollTop || window.pageYOffset
          const difference = targetDistanceFromTop - startingY
          const easing = this.bezierEasing(...this.cubicBezierArray)
          let start = null
          const step = (timestamp) => {
            if (!start) start = timestamp
            let progress = timestamp - start
            let progressPercentage = progress / this.duration
            if (progress >= this.duration) progress = this.duration
            if (progressPercentage >= 1) progressPercentage = 1
            const offset = this.scrollOffset || this.offset
            const perTick = startingY + (easing(progressPercentage) * (difference - offset))
            this.getScrollContainer.scrollTo(0, perTick)
            if (progress < this.duration) {
              this.scrollAnimationFrame = window.requestAnimationFrame(step)
            } else {
              resolve()
            }
          }
          window.requestAnimationFrame(step)
        })
      },

      /**
       * Scrolls the page to the element passed as a hash in URL, preventing weird native scroll
       * jumps while maintaining the hash in the URL.
       */
      scrollToHashElement() {
        const { hash } = window.location
        if (!hash) return
        const hashElement = document.querySelector(decodeURI(hash))
        if (!hashElement) return
        window.location.hash = '' // Clears the hash to prevent scroll from jumping
        setTimeout(() => {
          const yPos = hashElement.offsetTop - this.offset
          this.getScrollContainer.scrollTo(0, yPos)
          // Sets the hash back with pushState so it won't jump to the element ignoring the offset
          this.pushHashToUrl(hash)
        }, 0)
      },
    }
  }
</script>
