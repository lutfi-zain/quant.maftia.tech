import os
import importlib
import inspect
import sys
from quant.components.base import BaseComponent

def discover_components(db_path: str = "database/metrics.db") -> list[type[BaseComponent]]:
    """
    Scans the quant/components directory, dynamically imports all modules,
    and returns a list of all classes that inherit from BaseComponent (excluding BaseComponent itself).
    """
    components_dir = os.path.dirname(__file__)
    component_classes = []
    
    # We add components_dir to sys.path if not present to ensure imports resolve
    package_path = "quant.components"
    
    for filename in os.listdir(components_dir):
        if filename.endswith(".py") and filename not in ("__init__.py", "base.py", "registry.py", "normalization.py", "bitview_client.py"):
            module_name = filename[:-3]
            full_module_name = f"{package_path}.{module_name}"
            
            try:
                # Import module dynamically
                module = importlib.import_module(full_module_name)
                
                # Search for subclasses of BaseComponent
                for name, obj in inspect.getmembers(module, inspect.isclass):
                    if issubclass(obj, BaseComponent) and obj is not BaseComponent:
                        component_classes.append(obj)
            except Exception as e:
                # Log import error but continue to discover others
                import logging
                logging.getLogger(__name__).error(f"Error importing component module {full_module_name}: {str(e)}")
                
    # Sort by class name to ensure deterministic order
    component_classes.sort(key=lambda cls: cls.__name__)
    return component_classes
