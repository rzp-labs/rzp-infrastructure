The parameterized exception approach introduces several maintenance challenges:

## Consistency Problems

Without strict conventions, teams create divergent patterns:

```python
# Developer A's approach
class FieldRequiredError(ValidationError):
    def __init__(self, field_name: str = "field"):
        super().__init__(f"{field_name.title()} required")

# Developer B's approach
class MissingFieldError(ValidationError):
    def __init__(self, field: str, entity: str = ""):
        msg = f"Missing {field}" + (f" in {entity}" if entity else "")
        super().__init__(msg)

# Developer C's approach
class RequiredFieldException(ValueError):
    def __init__(self, **kwargs):
        field = kwargs.get('field', 'unknown')
        super().__init__(f"The {field} field is required")
```

Each works, but they create inconsistent APIs and error messages across the codebase.

## Refactoring Brittleness

Field renames cascade through exception calls:

```python
# Original
raise DescriptionRequiredError("task_description")

# After renaming field to 'summary'
# Must find and update all occurrences
raise DescriptionRequiredError("summary")  # Now semantically wrong class name
```

## Better Alternative: Structured Validation

Instead of exception proliferation, use a validation framework:

```python
from dataclasses import dataclass
from typing import List, Optional, Protocol
from enum import Enum

class ErrorCode(Enum):
    REQUIRED = "FIELD_REQUIRED"
    TOO_SHORT = "FIELD_TOO_SHORT"
    INVALID_FORMAT = "FIELD_INVALID_FORMAT"

@dataclass
class ValidationError:
    field: str
    code: ErrorCode
    message: str
    context: dict = None

    def format_message(self, formatter: 'MessageFormatter') -> str:
        return formatter.format(self)

class ValidationResult:
    def __init__(self):
        self.errors: List[ValidationError] = []

    def add_error(self, field: str, code: ErrorCode, **context):
        self.errors.append(ValidationError(
            field=field,
            code=code,
            message=f"{field}: {code.value}",
            context=context
        ))

    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def raise_if_invalid(self):
        if not self.is_valid():
            raise ValidationException(self.errors)

class Validator:
    def validate_required(self, value: any, field: str) -> Optional[ValidationError]:
        if not value:
            return ValidationError(
                field=field,
                code=ErrorCode.REQUIRED,
                message=f"{field} is required"
            )
        return None

    def validate_min_length(self, value: str, field: str, min_length: int) -> Optional[ValidationError]:
        if len(value) < min_length:
            return ValidationError(
                field=field,
                code=ErrorCode.TOO_SHORT,
                message=f"{field} must be at least {min_length} characters",
                context={"min_length": min_length, "actual": len(value)}
            )
        return None
```

Usage becomes standardized:

```python
def validate_task(data: dict) -> ValidationResult:
    result = ValidationResult()
    validator = Validator()

    # Consistent validation pattern
    if error := validator.validate_required(data.get('description'), 'description'):
        result.errors.append(error)
    elif error := validator.validate_min_length(data['description'], 'description', 10):
        result.errors.append(error)

    return result

# Clean usage
result = validate_task(task_data)
if not result.is_valid():
    # Handle errors consistently
    for error in result.errors:
        logger.warning(f"Validation failed: {error.code.value} on {error.field}")
```

## Advantages of Structured Validation

1. **Single source of truth** - Error codes and formats defined once
2. **Testable validation logic** - Validators are pure functions
3. **Composable rules** - Build complex validations from simple ones
4. **Internationalization ready** - Error codes map to locale-specific messages
5. **Consistent API** - Same pattern for all validations
6. **Machine readable** - Error codes enable programmatic handling

## When to Use Each Approach

**Custom exceptions work for:**

- Domain-critical errors (e.g., `InsufficientFundsError`)
- Errors requiring specific handling logic
- Public API boundaries

**Structured validation excels for:**

- Input validation
- Form processing
- API request validation
- Any scenario with multiple validation rules

The key insight: mypy pushed us toward better design, but the parameterized exception pattern is just one step. The real
solution often involves rethinking error handling as data flow rather than control flow.
