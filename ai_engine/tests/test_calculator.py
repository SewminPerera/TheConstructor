
import pytest
from calculator import calculate_foundation_only, calculate_full_estimate, DEFAULT_PRICES

def _parse_lkr(s):
    
    return float(str(s).replace("Rs. ", "").replace(",", ""))

class TestFoundationOnly:
   

    def test_basic_foundation(self):
      
        result = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={
                "door_count": 3,
                "window_count": 4,
                "wall_thickness": 9,
            },
            prices=DEFAULT_PRICES,
        )
        assert result["schema_version"] == 2
        assert _parse_lkr(result["costs_lkr"]["GRAND_TOTAL"]) > 0
        assert result["quantities"]["wall_length_m"] == 40

    def test_zero_wall_length(self):
    
        result = calculate_foundation_only(
            total_wall_length_m=0,
            user_choices={},
            prices=DEFAULT_PRICES,
        )
        assert result["schema_version"] == 2
        assert _parse_lkr(result["costs_lkr"]["GRAND_TOTAL"]) >= 0

    def test_result_has_all_sections(self):

        result = calculate_foundation_only(
            total_wall_length_m=30,
            user_choices={"door_count": 2, "window_count": 3},
            prices=DEFAULT_PRICES,
        )
        assert "costs_lkr" in result
        assert "quantities" in result
        assert "assumptions" in result
        assert "unit_rates_lkr" in result

    def test_quantities_are_positive(self):
        result = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={"door_count": 2, "window_count": 3},
            prices=DEFAULT_PRICES,
        )
        q = result["quantities"]
        assert q["concrete_m3"] > 0
        assert q["cement_bags"] > 0
        assert q["sand_m3"] > 0
        assert q["metal_m3"] > 0
        assert q["steel_kg"] > 0
        assert q["rubble_m3"] > 0

    def test_longer_walls_cost_more(self):
        
        small = calculate_foundation_only(
            total_wall_length_m=20,
            user_choices={"door_count": 1, "window_count": 2},
            prices=DEFAULT_PRICES,
        )
        large = calculate_foundation_only(
            total_wall_length_m=60,
            user_choices={"door_count": 1, "window_count": 2},
            prices=DEFAULT_PRICES,
        )
        assert _parse_lkr(large["costs_lkr"]["GRAND_TOTAL"]) > \
               _parse_lkr(small["costs_lkr"]["GRAND_TOTAL"])

    def test_soil_type_affects_assumptions(self):
      
        normal = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={"soil_type": "normal"},
            prices=DEFAULT_PRICES,
        )
        soft = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={"soil_type": "soft"},
            prices=DEFAULT_PRICES,
        )
        # Soft soil should have different depth/width multipliers
        assert soft["assumptions"]["soil_type"] == "soft"
        assert normal["assumptions"]["soil_type"] == "normal"
        assert soft["assumptions"]["soil_depth_multiplier"] >= normal["assumptions"]["soil_depth_multiplier"]

    def test_wastage_increases_cost(self):
        
        low = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={"wastage_pct": 5},
            prices=DEFAULT_PRICES,
        )
        high = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={"wastage_pct": 20},
            prices=DEFAULT_PRICES,
        )
        assert _parse_lkr(high["costs_lkr"]["GRAND_TOTAL"]) > \
               _parse_lkr(low["costs_lkr"]["GRAND_TOTAL"])

    def test_opening_deduction(self):
        
        no_openings = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={"door_count": 0, "window_count": 0},
            prices=DEFAULT_PRICES,
        )
        many_openings = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={"door_count": 5, "window_count": 8},
            prices=DEFAULT_PRICES,
        )
        assert no_openings["assumptions"]["effective_wall_length_m"] > \
               many_openings["assumptions"]["effective_wall_length_m"]

    def test_cement_brand_selection(self):
        
        generic = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={"cement_brand": "generic"},
            prices=DEFAULT_PRICES,
        )
        lanwa = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={"cement_brand": "Lanwa"},
            prices=DEFAULT_PRICES,
        )
        assert _parse_lkr(generic["costs_lkr"]["GRAND_TOTAL"]) > 0
        assert _parse_lkr(lanwa["costs_lkr"]["GRAND_TOTAL"]) > 0


class TestFullEstimate:
  

    def test_full_estimate_basic(self):
       
        result = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={
                "door_count": 3,
                "window_count": 4,
                "wall_height_m": 3.0,
                "number_of_floors": 1,
                "floor_area_m2": 100,
            },
            prices=DEFAULT_PRICES,
        )
        assert result["schema_version"] == 3
        assert "superstructure" in result
        assert "foundation" in result
        assert _parse_lkr(result["costs_lkr"]["SUPERSTRUCTURE_SUBTOTAL"]) > 0
        assert _parse_lkr(result["costs_lkr"]["FOUNDATION_SUBTOTAL"]) > 0

    def test_v3_has_all_superstructure_sections(self):
        
        result = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={
                "wall_height_m": 3.0,
                "number_of_floors": 1,
                "floor_area_m2": 100,
                "door_count": 2,
                "window_count": 3,
            },
            prices=DEFAULT_PRICES,
        )
        s = result["superstructure"]
        assert "wall_masonry" in s
        assert "lintels" in s
        assert "plastering" in s
        assert "flooring" in s
        assert "roofing" in s
        assert "painting" in s

    def test_grand_total_exceeds_subtotals(self):
        
        result = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={
                "door_count": 2,
                "window_count": 3,
                "wall_height_m": 3.0,
                "number_of_floors": 1,
                "floor_area_m2": 100,
                "wastage_pct": 10,
            },
            prices=DEFAULT_PRICES,
        )
        foundation_sub = _parse_lkr(result["costs_lkr"]["FOUNDATION_SUBTOTAL"])
        super_sub = _parse_lkr(result["costs_lkr"]["SUPERSTRUCTURE_SUBTOTAL"])
        grand = _parse_lkr(result["costs_lkr"]["GRAND_TOTAL"])
        assert grand >= foundation_sub + super_sub

    def test_multi_floor_costs_more(self):
       
        one_floor = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={
                "door_count": 3,
                "window_count": 4,
                "wall_height_m": 3.0,
                "number_of_floors": 1,
                "floor_area_m2": 100,
            },
            prices=DEFAULT_PRICES,
        )
        two_floors = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={
                "door_count": 3,
                "window_count": 4,
                "wall_height_m": 3.0,
                "number_of_floors": 2,
                "floor_area_m2": 100,
            },
            prices=DEFAULT_PRICES,
        )
        assert _parse_lkr(two_floors["costs_lkr"]["GRAND_TOTAL"]) > \
               _parse_lkr(one_floor["costs_lkr"]["GRAND_TOTAL"])

    def test_superstructure_masonry_blocks(self):
        
        result = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={
                "wall_height_m": 3.0,
                "number_of_floors": 1,
                "floor_area_m2": 100,
            },
            prices=DEFAULT_PRICES,
        )
        blocks = result["superstructure"]["wall_masonry"]["block_count"]
        assert blocks > 0

    def test_floor_area_affects_flooring_cost(self):
        
        small = calculate_full_estimate(
            total_wall_length_m=30,
            user_choices={"floor_area_m2": 50, "wall_height_m": 3.0},
            prices=DEFAULT_PRICES,
        )
        large = calculate_full_estimate(
            total_wall_length_m=30,
            user_choices={"floor_area_m2": 200, "wall_height_m": 3.0},
            prices=DEFAULT_PRICES,
        )
        small_floor = _parse_lkr(small["superstructure"]["flooring"]["cost_lkr"])
        large_floor = _parse_lkr(large["superstructure"]["flooring"]["cost_lkr"])
        assert large_floor > small_floor

    def test_taller_walls_more_masonry(self):
        
        short = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={"wall_height_m": 2.7, "floor_area_m2": 100},
            prices=DEFAULT_PRICES,
        )
        tall = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={"wall_height_m": 3.5, "floor_area_m2": 100},
            prices=DEFAULT_PRICES,
        )
        assert tall["superstructure"]["wall_masonry"]["block_count"] > \
               short["superstructure"]["wall_masonry"]["block_count"]

    def test_no_floor_area_still_works(self):
        
        result = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={"wall_height_m": 3.0},
            prices=DEFAULT_PRICES,
        )
        assert result["schema_version"] == 3
        assert _parse_lkr(result["costs_lkr"]["GRAND_TOTAL"]) > 0

    def test_lintel_count_matches_openings(self):
        
        result = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={
                "door_count": 4,
                "window_count": 6,
                "number_of_floors": 2,
                "wall_height_m": 3.0,
            },
            prices=DEFAULT_PRICES,
        )
        expected_lintels = (4 + 6) * 2  # 20
        assert result["superstructure"]["lintels"]["count"] == expected_lintels


class TestEdgeCases:
    

    def test_very_large_house(self):
       
        result = calculate_full_estimate(
            total_wall_length_m=500,
            user_choices={
                "door_count": 20,
                "window_count": 30,
                "wall_height_m": 3.0,
                "number_of_floors": 3,
                "floor_area_m2": 1000,
            },
            prices=DEFAULT_PRICES,
        )
        assert _parse_lkr(result["costs_lkr"]["GRAND_TOTAL"]) > 0

    def test_negative_wall_length_clamped(self):
       
        result = calculate_foundation_only(
            total_wall_length_m=-10,
            user_choices={},
            prices=DEFAULT_PRICES,
        )
        assert _parse_lkr(result["costs_lkr"]["GRAND_TOTAL"]) >= 0
        assert result["quantities"]["wall_length_m"] == 0

    def test_missing_user_choices(self):
        
        result = calculate_full_estimate(
            total_wall_length_m=40,
            user_choices={},
            prices=DEFAULT_PRICES,
        )
        assert result["schema_version"] == 3
        assert _parse_lkr(result["costs_lkr"]["GRAND_TOTAL"]) > 0

    def test_invalid_brand_falls_back(self):
        
        result = calculate_foundation_only(
            total_wall_length_m=40,
            user_choices={"cement_brand": "NonExistentBrand"},
            prices=DEFAULT_PRICES,
        )
        assert _parse_lkr(result["costs_lkr"]["GRAND_TOTAL"]) > 0

    def test_very_small_wall(self):
       
        result = calculate_foundation_only(
            total_wall_length_m=1,
            user_choices={},
            prices=DEFAULT_PRICES,
        )
        assert _parse_lkr(result["costs_lkr"]["GRAND_TOTAL"]) > 0


class TestPrices:
    
    def test_default_prices_have_required_materials(self):
        
        required = ["cement_bag", "sand_m3", "metal_m3", "steel_kg",
                     "rubble_m3", "labour_day"]
        for key in required:
            assert key in DEFAULT_PRICES, f"Missing price category: {key}"

    def test_default_prices_have_superstructure_materials(self):
        
        required = ["brick_each", "plaster_m2", "paint_m2", "floor_m2",
                     "roof_m2", "lintel_each"]
        for key in required:
            assert key in DEFAULT_PRICES, f"Missing superstructure price: {key}"

    def test_all_prices_positive(self):
        
        for key, value in DEFAULT_PRICES.items():
            if isinstance(value, dict):
                for brand, price in value.items():
                    assert price > 0, f"{key}.{brand} has non-positive price: {price}"
            elif isinstance(value, (int, float)):
                assert value > 0, f"{key} has non-positive price: {value}"

    def test_cement_has_generic(self):
        
        assert "generic" in DEFAULT_PRICES["cement_bag"]
