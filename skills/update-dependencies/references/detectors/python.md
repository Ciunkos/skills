# Python

Exact pins (`name==1.2.3`) in `requirements*.txt` and `pyproject.toml` are planned from PyPI upload times. Lock tools are reported for you to drive:

- uv: `uv lock --upgrade-package <name>` then `uv sync`; set `exclude-newer` in `pyproject.toml` (`[tool.uv]`) to a date at least 7 days back for the age rule.
- Poetry: `poetry update <name>`. pip-tools: `pip-compile --upgrade-package <name>`.
- Never run `pip install` against the system interpreter; use the project's virtual environment.
- Verify with the project's tests (`pytest`, `tox`, or what the README names).
