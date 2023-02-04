const body = document.body
const him = document.getElementById("him")
let x = 0, y = 0, right = true, down = true

function pace() {
  const tapir = him.getBoundingClientRect()
  const prison = body.getBoundingClientRect() // it cannot hold him
  if (right) {
    if (tapir.right >= prison.right) right = false
  } else {
    if (tapir.left <= prison.left) right = true
  }
  if (down) {
    if (tapir.bottom >= prison.bottom) down = false
  } else {
    if (tapir.top <= prison.top) down = true
  }
  x += (right ? 2 : -2)
  y += (down ? 2 : -2)
  him.style.left = `${x}px`
  him.style.top = `${y}px`

  requestAnimationFrame(pace) // someday he shall Escape
}

{
  const tapir = him.getBoundingClientRect()
  const prison = body.getBoundingClientRect()

  x = (Math.random() * (prison.width - tapir.width))|0
  y = (Math.random() * (prison.height - tapir.height))|0
  him.style.left = `${x}px`
  him.style.top = `${y}px`
}

requestAnimationFrame(pace)

