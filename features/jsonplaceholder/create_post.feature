@jsonplaceholder
Feature: JSONPlaceholder - POST /posts with boundary and invalid data (Section A3)
  JSONPlaceholder is a *fake* API: it accepts almost anything and answers 201 without validating.
  These scenarios therefore pin the part of the expected outcome that is true of the live service - it must never
  fail server-side (no 5xx), must answer with well-formed JSON, and must not corrupt the data it echoes back.
  The strict reading ("invalid input must be rejected with 4xx") is kept as @known-gap scenarios, run on demand
  with `npm run test:gap`, so the deviation is documented with evidence instead of hidden.

  Scenario: Control - a valid post is created
    When I create a post using the "valid" payload
    Then the response status is 201
    And the response body echoes the "valid" payload and adds an id

  Scenario Outline: Excessively long title (<payload>) never causes a server error
    When I create a post using the "<payload>" payload
    Then the API does not fail with a server error
    And the API answers with a controlled status of 201, 400, 413 or 422
    And a JSON body is returned when the request was accepted
    And an accepted title is echoed back without truncation or corruption

    Examples:
      | payload         |
      | title-1k        |
      | title-10k       |
      | title-100k      |
      | title-1m        |

  Scenario Outline: Unsupported special characters (<payload>) never cause a server error
    When I create a post using the "<payload>" payload
    Then the API does not fail with a server error
    And the API answers with a controlled status of 201, 400, 413 or 422
    And a JSON body is returned when the request was accepted
    And an accepted title is echoed back without truncation or corruption

    Examples:
      | payload          |
      | html-script      |
      | sql-injection    |
      | emoji            |
      | control-chars    |
      | null-byte        |
      | rtl-unicode      |
      | json-breakers    |
      | path-traversal   |

  Scenario Outline: Missing or malformed required fields (<payload>) never cause a server error
    When I create a post using the "<payload>" payload
    Then the API does not fail with a server error
    And the API answers with a controlled status of 201, 400, 413 or 422
    And a JSON body is returned when the request was accepted

    Examples:
      | payload            |
      | missing-userId     |
      | missing-title      |
      | missing-body       |
      | empty-object       |
      | userId-string      |
      | userId-negative    |
      | title-null         |
      | title-object       |
      | extra-fields       |

  @known-gap
  Scenario: DEFECT FOUND - a request body that is not valid JSON must not cause a server error
    When I send a malformed JSON body to create a post
    Then the API does not fail with a server error

  Scenario: A request with the wrong content type does not cause a server error
    When I create a post with the content type "text/plain"
    Then the API does not fail with a server error

  @known-gap
  Scenario Outline: Strict expectation - invalid input is rejected with a 4xx (<payload>)
    When I create a post using the "<payload>" payload
    Then the API rejects the request with a 4xx status

    Examples:
      | payload        |
      | title-1m       |
      | missing-userId |
      | missing-title  |
      | empty-object   |
      | userId-string  |
      | title-null     |
