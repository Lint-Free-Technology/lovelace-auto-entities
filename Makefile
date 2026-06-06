.PHONY: ha_up visual_test doc_images_gen doc_images_update

ha_up:
python tests/ha_server.py

visual_test:
pytest tests/visual/test_scenarios.py

doc_images_gen:
pytest tests/visual/test_doc_images.py

doc_images_update:
DOC_IMAGE_UPDATE=1 pytest tests/visual/test_doc_images.py