@validating-posts
Feature: A3 strict - a validating posts API rejects invalid input with proper error codes and never fails server-side
  The public JSONPlaceholder service accepts everything (see features/jsonplaceholder). This feature runs the same
  boundary and invalid-data payloads against a local posts API that validates, to demonstrate the expected outcome:
  appropriate 4xx codes and error messages for invalid input, and no 5xx for any input.

  Scenario: Control - a valid post is created
    When I create a post using the "valid" payload
    Then the response status is 201
    And the response body echoes the "valid" payload and adds an id

  Scenario Outline: Excessively long title (<payload>) is rejected with <status>
    When I create a post using the "<payload>" payload
    Then the response status is <status>
    And the error code is "<code>"
    And the API does not fail with a server error

    Examples:
      | payload    | status | code              |
      | title-1k   | 422    | VALIDATION_FAILED |
      | title-10k  | 422    | VALIDATION_FAILED |
      | title-100k | 422    | VALIDATION_FAILED |
      | title-1m   | 413    | PAYLOAD_TOO_LARGE |

  Scenario Outline: Unsupported special characters (<payload>) are rejected
    When I create a post using the "<payload>" payload
    Then the response status is 422
    And the error code is "VALIDATION_FAILED"
    And the error for field "title" says "title contains unsupported control or bidirectional characters"

    Examples:
      | payload       |
      | control-chars |
      | null-byte     |
      | rtl-unicode   |

  Scenario Outline: Ordinary special text (<payload>) is data, stored exactly as sent
    When I create a post using the "<payload>" payload
    Then the response status is 201
    And an accepted title is echoed back without truncation or corruption

    Examples:
      | payload        |
      | html-script    |
      | sql-injection  |
      | emoji          |
      | json-breakers  |
      | path-traversal |

  Scenario Outline: Missing or invalid required field (<payload>) is rejected with a clear message
    When I create a post using the "<payload>" payload
    Then the response status is 422
    And the error code is "VALIDATION_FAILED"
    And the error for field "<field>" says "<message>"

    Examples:
      | payload         | field  | message                           |
      | missing-userId  | userId | userId is required                |
      | missing-title   | title  | title is required                 |
      | empty-object    | userId | userId is required                |
      | userId-string   | userId | userId must be a positive integer |
      | userId-negative | userId | userId must be a positive integer |
      | title-null      | title  | title is required                 |
      | title-object    | title  | title must be a string            |

  Scenario: The optional body may be omitted
    When I create a post using the "missing-body" payload
    Then the response status is 201

  Scenario: Unknown fields are ignored and never stored
    When I create a post using the "extra-fields" payload
    Then the response status is 201
    And the response omits the field "isAdmin"

  Scenario: Malformed JSON is a client error, not a server failure
    When I send a malformed JSON body to create a post
    Then the response status is 400
    And the error code is "MALFORMED_JSON"

  Scenario: The wrong content type is rejected
    When I create a post with the content type "text/plain"
    Then the response status is 415
    And the error code is "UNSUPPORTED_MEDIA_TYPE"
