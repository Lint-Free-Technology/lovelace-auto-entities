.PHONY: ha_up visual_test doc_images_gen doc_images_update

ha_up:
	HA_VERSION=$(shell tr -d '[:space:]' < tests/HA_VERSION) HA_CONFIG_PATH=tests/ha-config HA_PLUGINS_YAML=tests/plugins.yaml HA_INTEGRATIONS_YAML=tests/integrations.yaml python -m ha_testcontainer.ha_server

visual_test:
pytest tests/visual/test_scenarios.py

doc_images_gen:
pytest tests/visual/test_doc_images.py

doc_images_update:
DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py