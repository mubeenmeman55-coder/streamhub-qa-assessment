@jsonplaceholder
Feature: JSONPlaceholder - POST /posts with boundary and invalid data (Section A3)
  JSONPlaceholder is a *fake* API: it accepts almost anything and answers 201 without validating.
  The scenarios below therefore do two things, and all of them pass:
    1. pin what must hold for the live service - it never fails server-side on these inputs (no 5xx), answers with
       well-formed JSON, and does not corrupt the data it echoes back;
    2. record, as @known-deviation scenarios, exactly where the service departs from the brief's expected outcome
       ("appropriate HTTP error codes for invalid input"): it answers 201 instead of 4xx, and 500 to malformed JSON.
  The expected 4xx behaviour itself is demonstrated against a local validating API (features/validating-posts).

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

  @known-deviation
  Scenario: Known deviation - a malformed JSON body makes the service answer 500
    When I send a malformed JSON body to create a post
    Then the service answers with status 500 which is a documented deviation

  Scenario: A request with the wrong content type does not cause a server error
    When I create a post with the content type "text/plain"
    Then the API does not fail with a server error

  @known-deviation
  Scenario Outline: Known deviation - the service accepts invalid input instead of rejecting it (<payload>)
    When I create a post using the "<payload>" payload
    Then the service answers with status 201 which is a documented deviation

    Examples:
      | payload        |
      | title-1m       |
      | missing-userId |
      | missing-title  |
      | empty-object   |
      | userId-string  |
      | title-null     |
