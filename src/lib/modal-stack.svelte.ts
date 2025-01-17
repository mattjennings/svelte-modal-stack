import { StackedModal, type ModalProps } from './stacked-modal.svelte'
import type { LazyModalComponent, ModalComponent } from './types'

export class ModalStack {
  /**
   * The current stack of modals
   */
  stack = $state<StackedModal[]>([])

  /**
   * The last action that was performed on the modals stack. This
   * can be useful for animations
   */
  action = $state<null | 'push' | 'pop'>(null)

  /**
   * Whether we're currently waiting for transitions to finish
   * before opening the next modal
   */
  transitioning = $state(false)

  /**
   * Opens a new modal
   */
  open = async <
    Props extends ModalProps = ModalProps,
    Exports extends Record<string, any> = {},
    Bindings extends keyof ModalProps | '' = string,
    Result = Props extends ModalProps<infer R> ? R : unknown
  >(
    component:
      | ModalComponent<Props, Exports, Bindings>
      | LazyModalComponent<Props, Exports, Bindings>,
    props?: Omit<Props, 'isOpen'>,
    options?: {
      /**
       * The id of the modal. Can be used to close it with closeById()
       */
      id?: string

      /**
       * This modal will close and replace the last modal in the stack.
       * If the current modal prevents closing it,
       * the promise will be rejected with an error
       */
      replace?: boolean
    }
  ): Promise<Result | undefined> => {
    if (this.transitioning) {
      return
    }

    if (options?.replace) {
      const closed = this.stack[this.stack.length - 1]?.close()
      if (!closed) {
        throw new Error('Current modal prevented closing')
      }
    }

    this.action = 'push'

    const currentModal = this.stack[this.stack.length - 1]

    if (currentModal?.exitBeforeEnter) {
      this.transitioning = true
    }

    const modal = new StackedModal(this, {
      id: options?.id,
      component,
      props
    })

    this.stack.push(modal)

    modal.addEventListener(
      'close',
      () => {
        if (modal.exitBeforeEnter) {
          this.transitioning = true
        }

        if (this.stack.indexOf(modal) > -1) {
          this.stack.splice(this.stack.indexOf(modal), 1)
        }

        this.action = 'pop'
      },
      {
        once: true
      }
    )

    return modal.promise
  }

  /**
   * Closes the last `amount` of modals in the stack
   *
   * If closing was prevented by any modal it returns false
   */
  close = (amount = 1): boolean => {
    if (typeof amount !== 'number' || amount < 1) {
      throw new Error(`amount must be a number greater than 0. Received ${amount}`)
    }

    const closedModals = this.stack.slice(this.stack.length - amount).reverse()

    let closedAmount = 0
    for (const modal of closedModals) {
      const closed = modal.close()
      if (!closed) {
        break
      }
      closedAmount++
    }

    return amount === closedAmount
  }

  /**
   * Closes a modal by its id. Can be provided with `options.id` in modals.open(Comp, props, options)
   */
  closeById = (id: string): boolean => {
    const modal = this.stack.find((modal) => modal.id === id)
    if (!modal) {
      return false
    }

    return modal.close()
  }

  /**
   * Closes all modals in the stack.
   *
   * If closing was prevented by any modal, it returns false
   */
  closeAll = (): boolean => {
    return this.close(this.stack.length)
  }
}
