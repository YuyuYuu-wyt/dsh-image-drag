/**
 * Host half of dsh-image-drag.
 *
 * The whole feature lives in the browser: the right sidebar's preview surface
 * and its tab strip are client-side UI. The host contributes nothing — this
 * module only exists so the bundle patch has a loader row to mount, which is
 * in turn what makes `dsh.client` hand the `lib/client.js` bundle to the web
 * app.
 */

export const name = 'dsh-image-drag'

export function apply() {
  // no host-side behaviour
}
