from pathlib import Path

TARGET = Path(
    r"d:\Github Project\Service Registry Management\python-workspace-access-control-service-fastapi\db\operations\operational_team_repo.py"
)

TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_text(
    Path(__file__).with_name("_operational_team_repo_body.txt").read_text(encoding="utf-8"),
    encoding="utf-8",
    newline="\n",
)
print("OK", TARGET)
