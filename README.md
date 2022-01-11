## Setup

Before start you have to set your data in config.json in root:

```
headlessMode - true / false - if false browser will be opened
login - "YourLogin@mail.com"
password - "YourPassword"
startPage - "1.1.1.1" - first page on book
finishPage - "2.1.2.2" - the last one
currentPage - "5.5.5.5" - the page to start reading from
minReadTime - 5000 - the minimum time for reading a visible block of text before scroll is clicked
maxReadTime - 10000 - the maximum one
bookSelector - "[attr='value']" - css selector for link to a book on a course page. 
The hardest option, you should open dev tools on course page and find a html 
element which navigates you to book page. 

For example selector for
    <a href="http://link.com"><span>page 1</span></span></a>
  will be:
    "[href='http://link.com']"
```
