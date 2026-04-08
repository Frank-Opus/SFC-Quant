import json
import sys
from pathlib import Path
from types import SimpleNamespace

VENDOR_ROOT = Path(__file__).resolve().parents[1] / 'vendor' / 'strategy_providers' / 'rdagent'
if str(VENDOR_ROOT) not in sys.path:
    sys.path.insert(0, str(VENDOR_ROOT))

from rdagent.components.coder.factor_coder.evolving_strategy import FactorMultiProcessEvolvingStrategy
from rdagent.components.coder.factor_coder.factor import FactorTask
from rdagent.scenarios.qlib.proposal.factor_proposal import QlibFactorHypothesis2Experiment
from rdagent.scenarios.qlib.proposal.quant_proposal import QlibQuantHypothesisGen


def test_quant_proposal_falls_back_from_meta_prompt_response() -> None:
    generator = object.__new__(QlibQuantHypothesisGen)
    response = json.dumps(
        {
            'action': 'factor',
            'hypothesis': 'Increase instruction specificity and output schema explicitness.',
            'reason': 'Return JSON only with explicit field ordering and no extra prose.',
        }
    )

    hypothesis = generator.convert_response(response)

    assert hypothesis.action == 'factor'
    assert 'momentum' in hypothesis.hypothesis.lower()
    assert 'baseline' in hypothesis.reason.lower()


def test_factor_proposal_falls_back_from_meta_factor_task() -> None:
    converter = object.__new__(QlibFactorHypothesis2Experiment)
    hypothesis = SimpleNamespace(
        hypothesis='Test a simple short-term momentum factor.',
        reason='Need an executable first-pass factor.',
    )
    trace = SimpleNamespace(hist=[])
    response = json.dumps(
        {
            'Output schema explicitness': {
                'description': 'Use JSON with fixed fields and no prose.',
                'formulation': 'Return valid JSON only.',
                'variables': {},
            }
        }
    )

    experiment = converter.convert_response(response, hypothesis, trace)

    assert experiment.sub_tasks
    assert experiment.sub_tasks[0].factor_name.startswith('short_term_momentum')


def test_factor_coder_builds_dsfc_fallback_python() -> None:
    strategy = object.__new__(FactorMultiProcessEvolvingStrategy)
    task = FactorTask(
        factor_name='short_term_momentum_5d',
        factor_description='[Momentum Factor] 5-day close return.',
        factor_formulation='close_t / close_{t-5} - 1',
        variables={'$close': 'Adjusted close price.'},
    )

    code = strategy._build_dsfc_fallback_factor_code(task)

    assert "daily_pv.h5" in code
    assert "result.h5" in code
    assert "pct_change(5)" in code
    assert "to_hdf" in code
