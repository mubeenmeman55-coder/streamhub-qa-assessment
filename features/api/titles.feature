@api @titles
Feature: Titles catalogue API - GET /api/titles and /api/titles/{id}

  Scenario: List titles with default pagination
    When I request the titles list with no parameters
    Then the response status is 200
    And the response has a "data" array of titles and pagination "meta"
    And the page size used is 10 and the page is 1

  Scenario Outline: Filter titles by <param>=<value>
    When I request the titles list with "<param>" set to "<value>"
    Then the response status is 200
    And every returned title satisfies "<param>" "<value>"

    Examples:
      | param     | value  |
      | genre     | drama  |
      | genre     | sci-fi |
      | type      | series |
      | type      | movie  |
      | minYear   | 2023   |
      | maxYear   | 2018   |
      | minRating | 8      |
      | q         | the    |

  Scenario: Combine filters, sorting and pagination
    When I request the titles list with:
      | genre  | drama  |
      | sortBy | rating |
      | order  | desc   |
      | limit  | 2      |
      | page   | 1      |
    Then the response status is 200
    And the titles are sorted by "rating" "desc"
    And the pagination meta reports limit 2 and page 1
    And at most 2 titles are returned

  Scenario Outline: Sort titles by <sortBy> <order>
    When I request the titles list with:
      | sortBy | <sortBy> |
      | order  | <order>  |
      | limit  | 50       |
    Then the response status is 200
    And the titles are sorted by "<sortBy>" "<order>"

    Examples:
      | sortBy   | order |
      | title    | asc   |
      | year     | desc  |
      | rating   | desc  |
      | duration | asc   |

  Scenario: Pagination pages do not overlap and cover all results
    When I fetch every page of titles with limit 10
    Then the pages contain each title exactly once

  Scenario: Filter with no matches returns an empty list, not an error
    When I request the titles list with "q" set to "zzzz-no-such-title"
    Then the response status is 200
    And at most 0 titles are returned

  Scenario: Get a title by id
    When I request the title with id 5
    Then the response status is 200
    And the title has id 5 and all expected fields

  Scenario Outline: Invalid list parameter <param>=<value> is rejected with 400
    When I request the titles list with "<param>" set to "<value>"
    Then the response status is 400
    And the error response has code "<code>" and a helpful message

    Examples:
      | param     | value      | code              |
      | limit     | 0          | INVALID_PARAMETER |
      | limit     | 51         | INVALID_PARAMETER |
      | limit     | abc        | INVALID_PARAMETER |
      | limit     | 2.5        | INVALID_PARAMETER |
      | page      | 0          | INVALID_PARAMETER |
      | page      | -1         | INVALID_PARAMETER |
      | minYear   | 1800       | INVALID_PARAMETER |
      | minYear   | twenty     | INVALID_PARAMETER |
      | minRating | 11         | INVALID_PARAMETER |
      | minRating | -0.5       | INVALID_PARAMETER |
      | sortBy    | popularity | INVALID_PARAMETER |
      | order     | sideways   | INVALID_PARAMETER |
      | genre     | horror-xyz | INVALID_PARAMETER |
      | type      | podcast    | INVALID_PARAMETER |
      | colour    | blue       | INVALID_PARAMETER |

  Scenario: minYear greater than maxYear is rejected
    When I request the titles list with:
      | minYear | 2024 |
      | maxYear | 2020 |
    Then the response status is 400
    And the error response has code "INVALID_RANGE" and a helpful message

  Scenario: Search text longer than 100 characters is rejected
    When I request the titles list with a search text of 101 characters
    Then the response status is 400
    And the error response has code "INVALID_PARAMETER" and a helpful message

  Scenario: Repeated parameter is rejected rather than guessed
    When I send the raw request "/api/titles?genre=drama&genre=comedy"
    Then the response status is 400
    And the error response has code "INVALID_PARAMETER" and a helpful message

  Scenario: Requesting a page beyond the last page returns 404
    When I request the titles list with "page" set to "99"
    Then the response status is 404
    And the error response has code "PAGE_OUT_OF_RANGE" and a helpful message

  Scenario: Unknown title id returns 404
    When I request the title with id 9999
    Then the response status is 404
    And the error response has code "NOT_FOUND" and a helpful message

  Scenario Outline: Non-numeric title id <id> returns 400
    When I send the raw request "/api/titles/<id>"
    Then the response status is 400
    And the error response has code "INVALID_PARAMETER" and a helpful message

    Examples:
      | id    |
      | abc   |
      | 1.5   |
      | -3    |
      | 1%20x |

  Scenario: Unknown route returns a JSON 404
    When I send the raw request "/api/does-not-exist"
    Then the response status is 404
    And the error response has code "ROUTE_NOT_FOUND" and a helpful message
