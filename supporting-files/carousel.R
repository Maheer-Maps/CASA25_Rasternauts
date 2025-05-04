library(htmltools)
library(yaml)

## code credit: https://quarto.org/docs/gallery/ - Github repo: https://github.com/quarto-dev/quarto-web/tree/main/docs/gallery
## simplified to add title, full-width image then full-width code with fixed height, keep caption above, adjust image size and caption font, remove border and padding, increase height

# carousel displays a list of items w/ nav buttons
carousel <- function(id, duration, items) {
  index <- -1
  items <- lapply(items, function(item) {
    index <<- index + 1
    # Ensure all fields exist, use defaults if missing
    item$title <- if (is.null(item$title) || item$title == "") "No title" else item$title
    item$caption <- if (is.null(item$caption) || item$caption == "") "No caption" else item$caption
    item$image <- if (is.null(item$image) || item$image == "") "images/placeholder.png" else item$image
    item$code <- if (is.null(item$code) || item$code == "") "No code" else item$code
    item$link <- if (is.null(item$link) || item$link == "") "" else item$link
    carouselItem(item$title, item$caption, item$image, item$link, item$code, index, duration)
  })
  
  indicators <- div(class = "carousel-indicators",
                    tagList(lapply(items, function(item) item$button))
  )
  items <- div(class = "carousel-inner",
               style = "height: 700px; width: 100%;",
               tagList(lapply(items, function(item) item$item))           
  )
  div(id = id, class = "carousel carousel-dark slide", `data-bs-ride` = "false", 
      style = "height: 700px; background-color: #f0f0f0; position: relative; width: 100%;",
      indicators,
      items,
      navButton(id, "prev", "Previous"),
      navButton(id, "next", "Next")
  )
}

# carousel item
carouselItem <- function(title, caption, image, link, code, index, interval) {
  id <- paste0("gallery-carousel-item-", index)
  button <- tags$button(type = "button", 
                        `data-bs-target` = paste0("#", "gallery-carousel"),
                        `data-bs-slide-to` = index,
                        `aria-label` = paste("Slide", index + 1))
  if (index == 0) {
    button <- tagAppendAttributes(button,
                                  class = "active",
                                  `aria-current` = "true")
  }
  
  # Title (at the top, no padding)
  title_element <- tags$p(class = "carousel-title", style = "padding: 0; color: #7b7f5f; font-size: 1.3em; font-family: 'News Cycle', 'Arial Narrow Bold', sans-serif; font-weight: bold; text-align: center; width: 100%;  margin: 0 auto; word-wrap: break-word; box-sizing: border-box;", title)
  
  # Caption (below title)
  caption_element <- tags$p(class = "fw-light", style = "padding: 10px 0; color: #000; font-size: 0.7em; text-align: center; width: 100%;  margin: 0 auto; word-wrap: break-word; box-sizing: border-box;", caption)
  
  # Full-width image with restricted size, no border
  image_row <- div(class = "image-row",
                   style = "padding: 10px 0; width: 100%;  text-align: center; margin: 0 auto; box-sizing: border-box;",
                   a(href = link, img(src = image, class = "d-block", style = "width: 100%;  max-height: 300px; height: auto; object-fit: contain; margin: 0 auto;")))
  
  # Full-width code snippet with fixed height
  code_row <- div(class = "code-row",
                  style = "padding: 10px 0; width: 100%;  text-align: center; margin: 0 auto; box-sizing: border-box;",
                  div(class = "code-snippet",
                      style = "font-family: 'Courier New', monospace; font-size: 0.8em; background-color: #f5f5f5; padding: 8px; border-radius: 3px; width: 90%; height: 200px; overflow-y: auto; white-space: pre-wrap; text-align: left; margin: 0 auto; word-wrap: break-word; box-sizing: border-box;",
                      code))
  
  item <- div(class = paste0("carousel-item", ifelse(index == 0, " active", "")),
              style = "width: 100%; height: 100%; padding: 20px 70px; text-align: center; box-sizing: border-box;",
              `data-bs-interval` = interval,
              title_element,
              caption_element,
              image_row,
              code_row
  )
  
  list(
    button = button,
    item = item
  )
}

# nav button
navButton <- function(targetId, type, text) {
  tags$button(class = paste0("carousel-control-", type),
              type = "button",
              `data-bs-target` = paste0("#", targetId),
              `data-bs-slide` = type,
              span(class = paste0("carousel-control-", type, "-icon"), `aria-hidden` = "true"),
              span(class = "visually-hidden", text))
}